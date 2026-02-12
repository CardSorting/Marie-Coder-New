module.exports = {
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
    },
    window: {
        createTextEditorDecorationType: () => ({ dispose: () => { } })
    },
    ThemeColor: function (id) { this.id = id; },
    Disposable: { from: () => ({ dispose: () => { } }) }
};
