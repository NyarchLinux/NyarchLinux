let _defaultTheme;
export function getDefaultTheme() {
    if (_defaultTheme)
        return _defaultTheme;

    _defaultTheme = new St.IconTheme();
    return _defaultTheme;
}

export function destroyDefaultTheme() {
    _defaultTheme = null;
}
