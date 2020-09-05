var startPage = '#signIn';  // Стартовая страница
var authorizedStartPage = '#documents'; // Стартовая страница для авторзинованного пользователя
var pages = ['#signIn', '#signUp']; // ID страниц, которые используются в приложении
var authorizedPages = ['#documents', '#settings', "#addDocument"]  // ID страниц для авторизированных пользователей
var messageDisplayed = false;
var currentUser;
var currentPage;
var serverSideActive = false; // Когда серверная часть будет включена, приложение начнет отправлять пост запросы
var db;
loadDataBase().then(result => {
    db = result;
})
getPreviousState(); // Получаем начальное состояние приложения в заивисмости от наличия сессии
loadBlock();  // Загружаем первоначальный блок

$(window).on('hashchange', function() {
    loadBlock();
});


// Скрываем всплывающее сообщение если пользователь производит клик вне его области
$(document).mouseup(function (e){
		let obj = $('#popUp');
		if (!obj.is(e.target) && !obj.has(e.target).length) {
		    obj.removeClass('showBlock');
            obj.hide();
        }
	});

function changeServerSideActive(node){
    let status = node.getAttribute('class');
    if (status === 'active') {
        setCookie('serverSide', '0');
        node.setAttribute('class', 'inactive');
        showMessage('Серверная часть выключена', 'err', false);
        serverSideActive = false;
    }
    if (status === 'inactive') {
        setCookie('serverSide', '1');
        node.setAttribute('class', 'active');
        showMessage('Серверная часть включена', 'msg', false);
        serverSideActive = true;
        loadDocuments();
    }
}

// Controllers
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
    let mainFile = node.find('#mainDoc')[0].files.length;
    let secFile = node.find('#secDoc')[0].files.length;
    if (!mainFile && !secFile){
        showMessage('Вы должны отправить документы');
        return false;
    }
    let formData = serializeFormToObject(node);
    if (saveDocument(formData))
        changeHashByNodeReff(node[0]);
    return false;
}

function saveDocument(formData){
    if (!serverSideActive){
        updateDataBase('documents', formData);
        loadDocuments();
        showMessage('Документ успешно сохранен', 'msg', false);
        return true;
    }
    if (serverSideActive){
        let form = $(currentPage + ' form');
        sendToBack(form);
    }
    return false;
}

function loadDocuments(){
    getDataBaseData('documents').then(result =>{ // Получаем значения
        let documents = result.filter(r => r['l'] === currentUser); // документов для текущего пользователя
        $('#documentsList').text('');
        for (let i = 0; i < documents.length; i++){
            let document = documents[i]['document'];
            $('#documentsList').append("<div id='" + documents[i]['id']  + "' class='group documentBlock'></div>");
            for (let field in document){
                $('#documentsList' + ' .documentBlock').prepend('<div hidden>' + documents[i]['document'][field] + '</div>');
            }
            $('#documentsList').append('<div class="btnGroup"><button class="backButton delete" onclick="location.hash = \'#addDocument\'">' +
                '<i class="fas fa-trash-alt"></i></button> ' +
                '<button class="backButton status" onclick="location.hash = \'#addDocument\'">' +
                '<i class="fas fa-check-square"></i></button>' +
                '<button class="backButton change" onclick="location.hash = \'#addDocument\'">' +
                '<i class="fas fa-pencil-alt"></i></button></div>');
        }
    })
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
// Controllers


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
            setCookie('authorized', login, 30);
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
    if (c.search('authorized') > 0) {
        currentUser = getCookie('authorized');
        currentPage = authorizedStartPage;
        location.hash = authorizedStartPage;
        return true;
    }
    return false;
}

function getCookie(name){
    if (!document.cookie.split('serverSide'))
        return document.cookie.split(name + '=')[1].split(';')[0];
    return false;
}

function logOut(){
    deleteCookie('authorized');
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
    if(getCookie('serverSide') == '0') {
        serverSideActive = false;
        $('#serverSide').attr('class', 'inactive');
    }
    else {
        serverSideActive = true;
        $('#serverSide').attr('class', 'active');
    }
    if (checkSession()) {
        currentPage = authorizedStartPage;
        showMessage('Добро пожаловать ' + currentUser, 'msg', false);
        if (!serverSideActive)  // Загружаем список документов из indexedDB только если серверная часть отключена
            loadDocuments();
    }
    else
        currentPage = startPage;
}

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

function updateDataBase(tableName, data){
    let t = db.transaction([tableName], 'readwrite');
    let objectStore = t.objectStore(tableName);
    objectStore.put(data);
    t.commit();
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

function fileUpload(node){
    let fileName = node.find('input[type="file"]')[0].files[0].name;
    node.find('.fileUploader').addClass('activeUploader').text(fileName);
    node.find('.docName').val(fileName);
}