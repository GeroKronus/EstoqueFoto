const photoDatabase = {
    categories: {
        cameras: {
            name: 'Câmeras',
            icon: '📷'
        },
        lentes: {
            name: 'Lentes',
            icon: '🔍'
        },
        iluminacao: {
            name: 'Iluminação',
            icon: '💡'
        },
        acessorios: {
            name: 'Acessórios',
            icon: '🎛️'
        }
    },

    items: []
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = photoDatabase;
}