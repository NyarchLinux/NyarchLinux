/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Marco Trevisan <marco.trevisan@canonical.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';
/* This is coming from gjs 1.72, adding options to allow not to replace the
 * original method, in case we want to avoid clashes with already used async
 * methods. This can be dropped when such requirements are not needed */
/**
 *
 * @param options
 * @param proto
 * @param asyncFunc
 * @param finishFunc
 */
function _promisify(options, proto, asyncFunc,
    finishFunc = `${asyncFunc.replace(/_(begin|async)$/, '')}_finish`) {
    if (proto[asyncFunc] === undefined) {
        throw new Error(`${proto} has no method named ${asyncFunc}`);
    }

    if (proto[finishFunc] === undefined) {
        throw new Error(`${proto} has no method named ${finishFunc}`);
    }

    if (proto[`_original_${asyncFunc}`] !== undefined) {
        if (options.keepOriginal && proto[`${asyncFunc}_promise`] === undefined) {
            proto[`${asyncFunc}_promise`] = proto[asyncFunc];
        }
        return;
    }

    if (!options) {
        options = {};
    }

    proto[`_original_${asyncFunc}`] = proto[asyncFunc];
    proto[options.keepOriginal ? `${asyncFunc}_promise` : asyncFunc] = function (...args) {
        if (!args.every(arg => typeof arg !== 'function')) {
            return this[`_original_${asyncFunc}`](...args);
        }
        return new Promise((resolve, reject) => {
            const callStack = new Error().stack.split('\n').filter(line => !line.match(/promisify/)).join('\n');
            this[`_original_${asyncFunc}`](...args, (source, res) => {
                try {
                    const result = source !== null && source[finishFunc] !== undefined
                        ? source[finishFunc](res)
                        : proto[finishFunc](res);
                    if (Array.isArray(result) && result.length > 1 && result[0] === true) {
                        result.shift();
                    }
                    resolve(result);
                } catch (error) {
                    if (error.stack) {
                        error.stack += `### Promise created here: ###\n${callStack}`;
                    } else {
                        error.stack = callStack;
                    }
                    reject(error);
                }
            });
        });
    };

    if (!options.keepOriginal && proto[`${asyncFunc}_promise`] === undefined) {
        proto[`${asyncFunc}_promise`] = proto[asyncFunc];
    }
}
