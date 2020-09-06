var startPage = '#signIn';  // Стартовая страница
var authorizedStartPage = '#documents'; // Стартовая страница для авторзинованного пользователя
var pages = ['#signIn', '#signUp']; // ID страниц, которые используются в приложении
var authorizedPages = ['#documents', '#settings', "#addDocument", '#editDocument']  // ID страниц для авторизированных пользователей
var messageDisplayed = false;
var currentUser;
var currentPage;
var serverSideActive = false; // Когда серверная часть будет включена, приложение начнет отправлять пост запросы
var db;
var idForUpdate = null;
var currentDate = new Date();  // Указать другую дату для тестирования статуса заявок
// (прим. Date(2020, 5, 10)) январь - 0

$(window).on('load', function(){
    loadDataBase().then(result => {
        db = result;  // Инициализируем базу данных
    });
    getPreviousState(); // Получаем начальное состояние приложения в заивисмости от наличия сессии
    loadBlock();  // Загружаем первоначальный блок
    loadDate();  // Блок с текущей датой
    $('.buttons').css('transform', 'translateY(0px)');
});

function loadDate(){
    $('#currentDate').html($('#currentDate').html() + currentDate.toDateInputValue());
}

$(window).on('hashchange', function() {
    loadBlock();  // Если хеш страницы меняется, вызываем функцию загрузчика контроллеров
});


$(window).on('mouseup', function (e){
		let obj = $('#popUp'); // Скрываем всплывающее сообщение если пользователь
		if (!obj.is(e.target) && !obj.has(e.target).length) { // производит клик вне его области
		    obj.removeClass('showBlock');
            obj.hide();
        }
});

// Контроллеры
function signUp(node){
    let login = $("input[type='text']", node)[0].value;
    let password = $("input[type='password']", node)[0].value;
    let passwordVer = $("input[type='password']", node)[1].value;
    if(verifyLogin(login) && verifyPassword(password) && verifyPairPassword(password, passwordVer)) {
        if (createNewUser(login, password))
            changeHashByNodeReff(node);
    }
    return false
}

function signIn(node){
    let login = $("input[type='text']", node)[0].value;
    let password = $("input[type='password']", node)[0].value;
    if (checkNotEmpty('Логин', login) && checkNotEmpty('Пароль', password)) {
        if (authUser(login, password))
            changeHashByNodeReff(node);
    }
    return false
}

function settings(node){
    let password = $("input[type='password']", node)[0].value;
    let passwordVer = $("input[type='password']", node)[1].value;
    if (verifyPairPassword(password, passwordVer) && verifyPassword(password)) {
        if (changePassword(currentUser, password))
            changeHashByNodeReff(node);
    }
    return false;
}

function addDocuments(node){
    let mainFile = node.find('input[name="mainDocName"]').val();
    if (!mainFile){
        showMessage('Вы должны предоставить документ основание');
        return false;
    }
    node.find('#date').val(currentDate.toDateInputValue());  // Сохраняем текущее время
    let formData = serializeFormToObject(node);
    if (saveDocument(formData))
        changeHashByNodeReff(node[0]);
    return false;
}

Date.prototype.toDateInputValue = (function() {
    let local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0,10);
});

function editDocument(node){
    let mainFile = node.find('input[name="mainDocName"]').val();
    if (!mainFile){
        showMessage('Вы должны предоставить документ основание');
        return false;
    }
    let formData = serializeFormToObject(node);
    if (updateDocument(formData))
        changeHashByNodeReff(node[0]);
    return false;
}
// Контроллеры

function changeServerSideActive(node){
    let status = node.getAttribute('class');
    if (status === 'active') {
        setCookie('serverSide', '0');
        node.setAttribute('class', 'inactive');
        showMessage('Серверная часть выключена', 'err', false);
        serverSideActive = false;
        loadDocuments();
    }
    if (status === 'inactive') {
        setCookie('serverSide', '1');
        node.setAttribute('class', 'active');
        showMessage('Серверная часть включена', 'msg', false);
        serverSideActive = true;
    }
}

function updateDocument(formData){
    if (!serverSideActive){
        updateDataBaseData('documents', formData, true);
        loadDocuments();
        showMessage('Документ успешно обновлен', 'msg', false);
        $('#editDocument input[type="file"]').val('');
        return true;
    }
    if (serverSideActive){
        let form = $(currentPage + ' form');
        sendToBack(form);
    }
    return false;
}

function saveDocument(formData){
    if (!serverSideActive){
        updateDataBaseData('documents', formData);
        loadDocuments();
        showMessage('Документ успешно сохранен', 'msg', false);
        $(currentPage + ' form')[0].reset();
        $(currentPage + ' .fileUploader').first().text('+ Документ основание').removeClass('activeUploader');
        $(currentPage + ' .fileUploader').last().text('+ Отчетный документ').removeClass('activeUploader');
        return true;
    }
    if (serverSideActive){
        let form = $(currentPage + ' form');
        sendToBack(form);
    }
    return false;
}

function loadDocuments(){
    let periods = {'m': 'М.', 'q': 'К.', 'y': 'Г.'};
    $('#documents').find('.secondBlock').addClass('loadingBlock');
    getDataBaseData('documents').then(result =>{ // Получаем значения
        let documents = result.filter(r => r['l'] === currentUser); // документов для текущего пользователя
        documents = documents.sort(function (a, b){  // Сортируем по статусу
            if (a['document']['status'] > b['document']['status'])
                return 1;
            if (a['document']['status'] < b['document']['status'])
                return -1;
            return 0;
        })
        let documentsList = $('#documentsList');
        documentsList.text('');
        for (let i = 0; i < documents.length; i++){
            let document = documents[i]['document'];
            documentsList.append("<div id='" + documents[i]['id']  + "' class='documentBlock'></div>");
            $('.documentBlock').last().append('<div class="fileTitle">'
                + documents[i]['document']['mainDocName'] + '</div>');
            let status = document['status'];
            let createdDate = parseISOString(document['createdDate']);
            let dateUntil = createdDate.getDate() + '.' + createdDate.getMonth() + '.' + createdDate.getFullYear();
            let newStatus = changeStatusByDate(createdDate, document['secPeriodT']);
            newStatus ? status = newStatus : null;
            $('#documentsList' + ' .documentBlock').last().addClass(status);
            $('#' + documents[i]['id']).append('<div class="btnGroup"><button class="backButton delete" ' +
                'onclick="deleteDocument($(this));">' +
                '<i class="fas fa-trash-alt"></i></button> ' +
                '<button class="backButton status" onclick="changeStatus($(this));">' +
                '<i class="fas fa-check"></i></button>' +
                '<button class="backButton change" onclick="loadDocument($(this).parent().parent());">' +
                '<i class="fas fa-pencil-alt"></i></button></div>' +
                '<div class="timeBlock"><i class="fas fa-business-time"></i> '
                + periods[document['secPeriodT']] + ' ' + document['secPeriodF'] +'' +
                '<span class="timeUntil">' + dateUntil + '</span>' +
                '</div>');
        }
    })
}

function changeStatusByDate(createdDate, type){
    // Статусы
    // Primary - обычный, Success - Выполненный, Warning - скоро истечет, Danger - нужно срочно сдавать
    if (type === 'q') {  // Обработчик квартальных отчетов
        let quarter = Math.floor(createdDate.getMonth() / 3 + 1);
        let currentQuarter = Math.floor(currentDate.getMonth() / 3 + 1);
        if (quarter === currentQuarter){
            if (createdDate.getMonth() === currentDate.getMonth()){
                if (currentDate.getDate() + 7 >= createdDate.getDate())
                    return "danger"; // Выставляем статус если до подачи отчета осталась неделя
                return 'warning';  // Выставляем статус если до подачи отчета остался месяц
            }
        }
    }
    if (type === 'm'){  // Обработчик месячных отчетов
        if (currentDate.getDate() + 7 >= createdDate.getDate())
            return 'danger'; // Выставляем статус если до подачи отчета осталась неделя
        else
            return 'warning';
    }
    return false;
}

function parseISOString(s) {
  let n = s.split(/\D+/);
  for (let i in n)
      n[i] = parseInt(n[i]);
  return new Date(n[0], --n[1], n[2]);
}

function loadDocument(node){
    let id = node.attr('id');
    idForUpdate = parseInt(id);
    getDataBaseData('documents').then(result => {
        let document = result.filter(r => r['id'] === parseInt(id) && r['l'] === currentUser);
        loadDocumentFormByObject(document[0]['document']);
        changeHashByUrl('editDocument');
    })
}

function loadDocumentFormByObject(obj){
    for (let field in obj){
        let f = $("#editDocument form input[name='" + field + "']");
        if (field === 'secPeriodT' || field === 'mainPeriodT')
            f = $("#editDocument form select[name='" + field + "']");
        f.val(obj[field]);
        f.trigger('change');
    }
}

function changeFileName(node){
    let fileUploader = node.parent().find('.fileUploader');
    if (node.parent().find('.docName').val()){
        fileUploader.addClass('activeUploader');
        fileUploader.text(node.val());
    }
}

function serializeFormToObject(form) {
    form = form.serializeArray();
    let formObject = {};
    $.each(form,
        function (i, v) {
            formObject[v.name] = v.value;
        });
    formObject = {'l': currentUser, 'document': formObject};
    return formObject;
}

function showMessage(text, type = 'err', popUp=true){
    let types = {  // Карта с типом сообщения, цветом и префиксом
        'err': {'color': '#db3359', 'prefix': '<i class="fas fa-times-circle"></i>'},
        'msg': {'color': '#00af86', 'prefix': '<i class="fas fa-check-circle"></i>'}}
    if (!Object.keys(types).includes(type))  // Если переданный тип сообщения не найден в карте,
        type = Object.keys(types)[0]; // оставляем первый из списка
    let obj;  // Назначаем блок для вывода информации, PopUp или topMessage
    popUp ? obj = $('#popUp') : obj = $('#message');
    if (!messageDisplayed && !$('.showBlock')[0]) {
        messageDisplayed = true;  // Не перекрываем анимацию запущенную перед этим
        obj.html(types[type]['prefix'] + ' ' + text).addClass('showBlock')
            .css('background-color', types[type]['color'])
            .css('display', 'flex')[0].scrollIntoView();
        setTimeout(function (){ // Убираем класс с анимацией по таймеру
            obj.removeClass('showBlock');
            setTimeout(function (){
                obj.hide();
                messageDisplayed = false;
                }, 500);
            }, 1000)
    }
}

function changeHashByNodeReff(node){
    location.hash = node.getAttribute('reffer');
}

function verifyLogin(login){
    let minLength = 6;
    let label = 'Логин';
    if (checkNotEmpty('Логин', login) && checkMinLen(label, login, minLength))
        return true;
    return false;
}

function verifyPassword(password){
    let minLength = 6;
    let label = 'Пароль';
    if (checkNotEmpty(label, password) && checkMinLen(label, password, minLength))
        return true;
    return false;
}

function verifyPairPassword(password1, password2){
    if (password1 !== password2){
        showMessage('Пароли не совпадают');
        return false;
    }
    return true
}

function checkUserExist(login){
    return !!localStorage.getItem(login);
}

function createNewUser(login, password){
    if (!serverSideActive) {
        if (checkUserExist(login)) {
            showMessage('Пользователь уже существует');
            return false;
        }
        localStorage.setItem(login, password);  // Сохраняем пользователя в локальное хранилище
        showMessage('Пользователь успешно создан', 'msg', false);
        return true;
    }
    if (serverSideActive){
        let form = $(currentPage + ' form');
        sendToBack(form);
    }
}

function authUser(login, password){
    if (!serverSideActive) {  // Если серверная сторона не активирована //localStorage.getItem(login) === password
       if (localStorage.getItem(login) === password) {  // Проверяем наличие пары Логин: Пароль в локальном храналище
            showMessage('Успешная авторизация', 'msg', false);
            setCookie('authorized', login, 60 * 48);
            currentUser = login;
            getPreviousState();
            return true;
       }
       showMessage('Некорректные данные');
    }
    if (serverSideActive){  // При условии активированной серверной стороны
        let form = $(currentPage + ' form');
        sendToBack(form); // Отсылаем форму
    }
    return false;
}

function checkNotEmpty(label, data){
    if (!data.trim()) {
        showMessage(label + ' не может быть пустым');
        return false;
    }
    return true;
}

function checkMinLen(label, data, len){
    if (data.length < len){
        showMessage(label + ' слишком короткий мин. ' + len + ' символов');
        return false;
    }
    return true;
}

function setCookie(key, value, minutes){
    document.cookie = key + '=' + value + ';max-age=' + minutes * 60;
}

function checkSession(){
    let c = document.cookie;
    if (c.search('authorized') !== -1) {
        currentUser = getCookie('authorized');
        currentPage = authorizedStartPage;
        location.hash = authorizedStartPage;
        return true;
    }
    return false;
}

function getCookie(name){
    if (document.cookie.split(name).length > 1)
        return document.cookie.split(name + '=')[1].split(';')[0];
    return false;
}

function logOut(){
    deleteCookie('authorized');
    $('.headerBtn').hide();
    currentUser = null;
    location.hash = startPage;
}

function deleteCookie(name) {
  document.cookie = name +'=; Path=/; max-age=-1;';
}

function loadBlock(){
    currentPage = location.hash;
    let allowedPages = [];
    currentUser ? allowedPages = authorizedPages : allowedPages = pages;
    if (allowedPages.includes(currentPage)) {
        if (currentPage === '#editDocument' && !idForUpdate){
            currentPage = authorizedStartPage;
            showMessage('Вы не выбрали документ для редактирования');
            location.hash = currentPage;
        }
        $(currentPage).css('display', 'grid');
        hideBlocks(currentPage);
    }
    else{
        $(startPage).css('display', 'grid');
        hideBlocks(startPage);
    }
}

function hideBlocks(exclude){
    for (let i = 0; i < pages.length; i++){
        if (pages[i] !== exclude) // Прячем все блоки, кроме запрошенного
            $(pages[i]).hide();
    }
    for (let i = 0; i < authorizedPages.length; i++){
        if (authorizedPages[i] !== exclude) // Прячем все блоки, кроме запрошенного
            $(authorizedPages[i]).hide();
    }
}

function changeHashByUrl(url){
    let slashCount = url.split('/').length;
    location.hash = '#' + url.split('/')[slashCount - 1];
}

function changePassword(login, password){
    if (!serverSideActive) {
        localStorage.setItem(login, password);
        showMessage('Пароль успешно изменен', 'msg', false);
        return true;
    }
    if (serverSideActive){
        let form = $(currentPage + ' form');
        sendToBack(form);
    }
    return false;
}

function getPreviousState(){
    if(getCookie('serverSide') === '0') {
        serverSideActive = false;
        $('#serverSide').attr('class', 'inactive');
    }
    else if(getCookie('serverSide') === '1') {
        serverSideActive = true;
        $('#serverSide').attr('class', 'active');
    }
    else
        setCookie('serverSide', '0');
    if (checkSession()) {
        currentPage = authorizedStartPage;
        $('.headerBtn').show();
        showMessage('Добро пожаловать ' + currentUser, 'msg', false);
        if (!serverSideActive)  // Загружаем список документов из indexedDB только если серверная часть отключена
            loadDocuments();
        else
            $('#documents').find('.secondBlock').removeClass('loadingBlock');
    }
    else {
        $('.headerBtn').hide();
        currentPage = startPage;
    }
}

function fileUpload(node){
    let fileName = node.find('input[type="file"]')[0].files;
    if(fileName.length) {
        fileName = fileName[0].name;
        node.find('.fileUploader').addClass('activeUploader').text(fileName);
        node.find('.docName').val(fileName);
    }
}

function deleteDocument(node){
    if(confirm('Вы уверены что хотите удалить документ?')){
        let parentNode = node.parent().parent();
        let id = parentNode.attr('id');
        parentNode.fadeOut(500, 'linear', function (){
            parentNode.remove();
        });
        parentNode.find('.timeBlock').hide();
        parentNode.css('transform', 'translate(50vw, 0px)');
        deleteDataBaseData('documents', id);
    }
}

function changeStatus(node){
    let parent = node.parent().parent();
    let parentClass = parent.attr('class');
    let newStatus = null;
    if (parentClass.split(' ', ).pop() === 'primary')
        newStatus = 'success';
    else
        newStatus = 'primary';
    let documentBlock = $('.documentBlock');
    let documentsList = $('#documentsList');
    let lastBlock = documentsList.find('.documentBlock').last()[0];
    parent.removeClass(parentClass.split(' ', ).pop()).addClass(newStatus);
    if (documentBlock.length > 1 && newStatus === 'success'
        && (parent[0] !== lastBlock)) {
        parent.fadeOut(500, 'linear', function () {
            documentsList.append(parent);
            parent.show();
            parent.css('transform', 'translate(0px, 0px)');
            documentBlock.css('transform', 'translate(0px, 0px)');
        });
        documentBlock.css('transform', 'translate(0px, 15px)');
        parent.css('transform', 'translate(50vw, 0px)');
    }
    let id = parent.attr('id');
    idForUpdate = parseInt(id);
    getDataBaseData('documents').then(result => {
        let document = result.filter(r => r['id'] === parseInt(id) && r['l'] === currentUser)[0];
        document['document'].status = newStatus;
        updateDataBaseData('documents', document, true);
    })
}

// Функции для работы с БД
function loadDataBase(){
    return new Promise(resolve => {
        let request = window.indexedDB.open('documents', 1);
        request.onupgradeneeded = function(event) {
            db = event.target.result;
            let objectStore = db.createObjectStore("documents",
                { keyPath: "id", autoIncrement: true });
            objectStore.createIndex("id", "id", { unique: true });
            objectStore.createIndex("login", "l", { unique: false });
            objectStore.createIndex("document", "d", { unique: false});
            resolve(event.target.result);
        };
        request.onsuccess = function(event) {
            db = event.target.result;
            resolve(event.target.result);
        };
    })
}

function getDataBaseData(tableName){
    return new Promise((resolve) => {
        if (!db){  // Если база данных не создана, создаем промис и ждем
            loadDataBase().then(result => {
                let t = db.transaction([tableName], 'readonly');
                let objectStore = t.objectStore(tableName);
                let objectStoreRequest = objectStore.getAll();
                objectStoreRequest.onsuccess = function (e) {
                    resolve(objectStoreRequest.result);
                };
            })
        }
        else{
            let t = db.transaction([tableName], 'readonly');
                let objectStore = t.objectStore(tableName);
                let objectStoreRequest = objectStore.getAll();
                objectStoreRequest.onsuccess = function (e) {
                    resolve(objectStoreRequest.result);
                };
        }
    })
}

function updateDataBaseData(tableName, data, updateExists = false){
    let t = db.transaction([tableName], 'readwrite');
    let objectStore = t.objectStore(tableName);
    if (updateExists){
        let o = objectStore.get(idForUpdate);
        o.onsuccess = function (){
            data['id'] = idForUpdate;
            objectStore.put(data);
            idForUpdate = null;
            t.commit();
        }
    }
    if (!updateExists) {
        objectStore.put(data);
        t.commit();
    }
}

function deleteDataBaseData(tableName, key){
    let t = db.transaction([tableName], 'readwrite');
    let objectStore = t.objectStore(tableName);
    objectStore.delete(parseInt(key));
    t.commit();
}
// Функции для работы с БД

// Функции для бэкенда
function sendToBack(form){
    let url = form.attr('action');
    let reffer = form.attr('reffer');
    $.ajax({
            url: url,
            method: 'POST',
            data: form.serialize(),
            complete: function (response) {
                let data;
                try {  // Пытаемся спарсить JSON из ответа
                    data = JSON.parse(response.responseText);
                }
                catch (e) {
                    data = null;
                }
                if (data) { // Серверу необходимо установить куки для корректной работы в формате
                    // authorized=Логин пользователя
                    let message = data['message'];
                    let status = data['status'];
                    if (status == '0') {  // Если статус с бэка 0 - значит все прошло успешно
                        showMessage(message, 'msg', false); // Выводим полученное сообщение
                        location.hash = reffer;
                    }
                    showMessage(message);
                }
                else
                    showMessage('Ошибка сервера');
            }
        })
}
// Функции для бэкенда