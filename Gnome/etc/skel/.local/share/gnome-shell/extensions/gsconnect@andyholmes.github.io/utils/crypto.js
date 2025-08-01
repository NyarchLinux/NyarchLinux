// SPDX-FileCopyrightText: GSConnect Developers https://github.com/GSConnect
//
// SPDX-License-Identifier: GPL-2.0-or-later

const {Gio, GLib} = imports.gi;

/*
 * If a path points to a valid executable, use it, else use the fallback value.
 *
 * @param {string} exePath - The disk location to validate as an executable
 * @param {string} fallback - The value to return if exePath isn't executable
 * @returns {string} either the exePath value or the fallback value
 */
function validate_exe_path(exePath, fallback) {
    if (GLib.file_test(exePath || '', GLib.FileTest.IS_EXECUTABLE))
        return exePath;
    return fallback;
};


var read_cert_file = function (certPath) {
    const cFile = Gio.File.new_for_path(certPath);
    const cBytes = cFile.load_bytes(null)[0];
    const decoder = new TextDecoder();
    return decoder.decode(cBytes);
}


/**
 * Creates a GTlsCertificate from the PEM-encoded data in %cert_path and
 * %key_path. If either are missing a new pair will be generated.
 *
 * Additionally, the private key will be added using ssh-add to allow sftp
 * connections using Gio.
 *
 * See: https://github.com/KDE/kdeconnect-kde/blob/master/core/kdeconnectconfig.cpp#L119
 *
 * @param {string} opensslPath - The location of the 'openssl' executable to
 *                               run, or null / '' / 'openssl' to use the $PATH
 * @param {string} certPath - Absolute path to a x509 certificate in PEM format
 * @param {string} keyPath - Absolute path to a private key in PEM format
 * @param {string} commonName - A unique common name for the certificate
 * @returns {Gio.TlsCertificate} A TLS certificate
 */
var generate_cert_pair = function (
    opensslPath, certPath, keyPath, commonName = null
) {
    // If we weren't passed a common name, generate a random one
    if (!commonName)
        commonName = GLib.uuid_string_random().replaceAll('-', '_');

    const proc = new Gio.Subprocess({
        argv: [
            validate_exe_path(opensslPath, 'openssl'), 'req',
            '-newkey', 'ec',
            '-pkeyopt', 'ec_paramgen_curve:prime256v1',
            '-keyout', keyPath,
            '-new', '-x509', '-nodes',
            '-days', '3650',
            '-subj', `/O=andyholmes.github.io/OU=GSConnect/CN=${commonName}`,
            '-out', certPath,
        ],
        flags: (Gio.SubprocessFlags.STDOUT_SILENCE |
                Gio.SubprocessFlags.STDERR_SILENCE),
    });
    proc.init(null);
    proc.wait_check(null);
};

/**
 * Look up the common name of a certificate.
 *
 * @param {string} opensslPath - The location of the 'openssl' executable to
 *                               run, or null / '' / 'openssl' to use the $PATH
 * @param {string} certPem - The certificate as a PEM-encoded string
 * @returns {string} the common name value for the certificate
 */
var get_common_name = function (opensslPath, certPem) {
    const proc = new Gio.Subprocess({
        argv: [validate_exe_path(opensslPath, 'openssl'),
               'x509',
               '-noout',
               '-subject',
               '-inform',
               'pem',
        ],
        flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
    });
    proc.init(null);

    const stdout = proc.communicate_utf8(certPem, null)[1];
    const commonName = /(?:cn|CN) ?= ?([^,\n]*)/.exec(stdout)[1];
    if (!commonName)
        throw new Error('Failed to extract common name!');
    return commonName;
}

/**
 * Get just the pubkey as a DER ByteArray of a certificate.
 *
 * @param {string} opensslPath - The location of the 'openssl' executable to
 *                               run, or null / '' / 'openssl' to use the $PATH
 * @param {string} certPem - The certificate as a PEM-encoded string
 * @returns {GLib.Bytes} The pubkey as DER of the certificate.
 */
var get_pubkey_der = function (opensslPath, certPem) {
    let proc = new Gio.Subprocess({
        argv: [
            validate_exe_path(opensslPath, 'openssl'),
            'x509',
            '-noout',
            '-pubkey',
            '-inform',
            'pem'
        ],
        flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
    });
    proc.init(null);
    const pubkey = proc.communicate_utf8(certPem, null)[1];

    proc = new Gio.Subprocess({
        argv: [
            validate_exe_path(opensslPath, 'openssl'),
            'pkey',
            '-pubin',
            '-inform', 'pem',
            '-outform', 'der'
        ],
        flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
    });
    proc.init(null);
    const pubkey_der = proc.communicate(new TextEncoder().encode(pubkey), null)[1];
    if (!pubkey_der)
        throw new Error('Failed to extract pubkey DER!');
    return pubkey_der;
};
