export default {
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    close: 'Закрыть',
    yes: 'Да',
    no: 'Нет',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно'
  },
  topMenu: {
    project: 'Проект',
    tools: 'Инструменты',
    view: 'Вид',
    discussions: 'Обсуждения',
    toggleTheme: 'Переключить тему',
    lightTheme: 'Вернуть светлое меню',
    darkTheme: 'Включить тёмное меню',
    undo: 'Отменить (Ctrl+Z)',
    redo: 'Повторить (Ctrl+Shift+Z)'
  },
  viewMenu: {
    title: 'Вид',
    showGrid: 'Показать сетку',
    gridStep: 'Шаг',
    gridBackground: 'Фон сетки',
    lines: 'Линии',
    lineThickness: 'Толщина',
    applyToAllLines: 'Ко всем линиям',
    applyToUserCardLines: 'Линии карточек',
    selectLineColor: 'Выбрать цвет линий',
    animation: 'Анимация',
    animationEnabled: 'Анимация включена',
    animationDisabled: 'Анимация выключена',
    selectAnimationColor: 'Выбрать цвет анимации',    
    duration: 'Длительность',
    seconds: 'сек',
    background: 'Фон',
    lightBackground: 'Светлый фон',
    darkBackground: 'Темный фон',
    selectBackgroundColor: 'Выбрать цвет фона',
    headerColor: 'Цвет заголовка',
    selectHeaderColor: 'Выбрать цвет заголовка',
    changeColor: 'Сменить цвет',
    currentIndex: 'Текущий индекс',
    language: 'Язык',
    tooltips: {
      showGrid: 'Включает отображение сетки на доске для удобного размещения элементов',
      lines: 'Настройка цвета и толщины линий связей между карточками',
      animation: 'Анимация пульсации линий связей — помогает визуально выделить структуру',
      background: 'Выбор цвета фона доски — светлый, тёмный или произвольный',
      headerColor: 'Цвет заголовка карточек партнёров на доске',
      language: 'Переключение языка интерфейса'
    }
  },
  projectMenu: {
    saveJson: 'Сохранить проект',
    loadJson: 'Загрузить проект',
    shareProject: 'Поделиться проектом',
    saveAs: 'Сохранить как',
    share: 'Поделиться',
    shareTelegram: 'Telegram',
    shareVk: 'ВКонтакте',
    exportHtml: 'Экспорт в HTML',
    exportSvg: 'Экспорт в SVG',
    exportPng: 'Экспорт в PNG',
    print: 'Печать',
    tooltips: {
      saveJson: 'Сохраняет доску в файл на компьютер для резервного копирования',
      loadJson: 'Открывает ранее сохранённый файл доски с компьютера',
      exportHtml: 'Сохраняет доску как веб-страницу, которую можно открыть в любом браузере без подключения к интернету. А так же отправить партнёру, наставнику для анализа вашей структуры',
      exportSvg: 'Сохраняет доску в векторном формате для печати в высоком качестве',
      exportPng: 'Сохраняет доску как картинку — удобно для отправки в мессенджерах',
      print: 'Отправляет доску на принтер или сохраняет как PDF'
    }
  },
  toolsMenu: {
    title: 'Инструменты',
    selectionMode: 'Режим выделения',
    hierarchyMode: 'Режим иерархии',
    drawingMode: 'Режим рисования',
    showGuides: 'Показать направляющие',
    clearCanvas: 'Очистить холст',
    newStructure: 'Новая структура',
    clearConfirmTitle: 'Подтверждение очистки',
    clearConfirmMessage: 'Вы уверены, что хотите очистить холст? Все объекты будут удалены.',
    continueAction: 'Продолжить',
    newStructureTitle: 'Новая структура',
    newStructureMessage: 'Хотите сохранить текущую структуру перед созданием новой?',
    dontSave: 'Не сохранять',
    saveAndCreate: 'Сохранить и создать новую',
    tooltips: {
      drawingMode: 'Переключение в режим рисования:<br>1) Делает снимок видимой области<br>2) Подходит для презентаций',
      hierarchyMode: 'При захвате и перемещении лицензии:<br>Шапка — перемещает всю структуру ниже<br>Левый край — перемещает левую ветку<br>Правый край — перемещает правую ветку',
      showGuides: 'Показывает направляющие линии для точного выравнивания элементов на доске',
      clearCanvas: 'Удаляет все элементы с доски — карточки, связи, изображения, стикеры',
      newStructure: 'Создаёт новую чистую доску. Можно сохранить текущую перед этим'
    }
  },
  discussionMenu: {
    title: 'Обсуждение',
    notesList: 'Календарь',
    boardComments: 'Заметки',
    stickerMessages: 'Стикеры',
    allStickers: 'Все стикеры',
    addSticker: 'Добавить стикер',
    setAnchor: 'Установить точку',
    boardAnchors: 'Точки на доске',
    geolocation: 'Геолокация',
    createStructureAlert: 'Пожалуйста, создайте новую структуру или войдите в существующую, чтобы добавить стикер.',
    tooltips: {
      partners: 'Список всех партнёров на текущей доске с поиском и фильтрацией',
      notesList: 'Список всех записей в календарях по каждой лицензии.<br>Поиск, удаление',
      images: 'Библиотека изображений — загрузка, просмотр и размещение на доске.<br>Создание собственных галерей.<br>Избранное',
      boardComments: 'Оставляйте комментарии и заметки чтобы не забыть',
      geolocation: 'Точки геолокации на доске — если структура большая, ставьте точку, чтобы быстро перейти в нужное место структуры',
      stickerMessages: 'Стикеры-заметки на доске — цветные карточки с текстом'
    }
  },
  board: {
    saveStructure: 'Сохранить структуру',
    savePrompt: 'Задайте название структуры, чтобы сохранить',
    createError: 'Достигнут лимит создания досок',
    createFailed: 'Не удалось создать структуру',
    loadError: 'Не удалось загрузить структуру',
    saveError: 'Ошибка сохранения',
    limitReached: 'Достигнут лимит на вашем тарифе',
    autoFitZoom: 'Автоподгонка масштаба',
    structureName: 'Название структуры',
    myStructures: 'Мои структуры',
    sharedStructures: 'Совместные структуры',
    saving: 'Сохранение...',
    savedAt: 'Сохранено в',
    noSaves: 'Нет сохранений',
    renameStructure: 'Переименовать структуру',
    untitled: 'Без названия'
  },
  auth: {
    login: 'Войти',
    logout: 'Выйти',
    register: 'Регистрация',
    email: 'Email',
    password: 'Пароль',
    forgotPassword: 'Забыли пароль?',
    resetPassword: 'Сбросить пароль',
    confirmPassword: 'Подтвердите пароль',
    confirmLogout: 'Вы уверены, что хотите выйти?'
  },
  profile: {
    title: 'Профиль',
    settings: 'Настройки',
    subscription: 'Подписка',
    logout: 'Выйти из аккаунта'
  },
  toolbar: {
    addCard: 'Добавить карточку',
    addUserCard: 'Добавить карточку партнёра',
    addSticker: 'Добавить стикер',
    addConnection: 'Добавить связь',
    undo: 'Отменить',
    redo: 'Повторить',
    zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить',
    resetZoom: 'Сбросить масштаб'
  },
  card: {
    title: 'Заголовок',
    description: 'Описание',
    addImage: 'Добавить изображение',
    removeImage: 'Удалить изображение',
    changeColor: 'Изменить цвет'
  },
  mobile: {
    menu: 'Меню',
    boards: 'Доски',
    settings: 'Настройки',
    profile: 'Профиль'
  },
  notifications: {
    saved: 'Изменения сохранены',
    saveError: 'Ошибка при сохранении',
    copied: 'Скопировано в буфер обмена',
    limitReached: 'Достигнут лимит'
  },
  editor: {
    zoom: 'Масштаб'
  },
  noteWindow: {
    zoomIn: 'Увеличить календарь',
    zoomOut: 'Уменьшить календарь'
  }
}
