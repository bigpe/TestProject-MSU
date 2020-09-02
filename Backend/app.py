from flask import Flask, render_template, make_response, Response, request, redirect
from flask_wtf.csrf import CSRFProtect
from flask_sqlalchemy import SQLAlchemy
import json, os, re, datetime
from hashlib import md5

secretKey = os.urandom(32)
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = secretKey
db = SQLAlchemy(app)
csrf = CSRFProtect(app)
csrf.init_app(app)
cookieTimeMinutes = 10


# Модели базы данных
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fullName = db.Column(db.String(100), nullable=False)
    login = db.Column(db.String(100), nullable=False, unique=True)
    password = db.Column(db.String(32), nullable=False)


db.create_all()  # Создаем базу данных со вложенными моделями


@app.route('/')
def index():
    if checkSession(request.cookies):  # Если пользователь авторизован, переадресовываем
        return make_response(sRedirect())
    return render_template('start.html')


@app.route('/pre_signin', methods=['POST'])
def preSignIn():
    data = request.get_json()
    status = '1'
    message = 'Логин и пароль не должны быть пустыми'
    if 'l' in data and 'p' in data:
        if checkAuth(data['l'], data['p']):
            status = '0'
            message = 'Успешная авторизация'  # Устанавливаем куки PreAuthorized на 1 минуту
            cookie = ['PreAuthorized', '1', datetime.timedelta(minutes=cookieTimeMinutes)]
        else:
            message = 'Неправильные данные'
    r = json.dumps({'status': status, 'message': message})
    res = Response(r, mimetype='application/json')
    if 'cookie' in locals():
        res.set_cookie(*cookie)
    return res


@app.route('/signin', methods=['POST'])
def signIn():
    if request.cookies.get('PreAuthorized'):
        res = make_response(sRedirect())
        res.set_cookie('Authorized', '1', datetime.timedelta(minutes=cookieTimeMinutes))
        return res
    return redirect('/')


def sRedirect():
    return redirect('https://yandex.ru')


@app.route('/reg', methods=['POST'])
def signUp():
    message = checkData(request.get_json())  # Проверяем данные на валидность
    status = '1'
    if not message:
        message = 'Успешная регистрация'
        data = request.get_json()
        # Получаем данные и удаляем лишние пробелы
        fullName = data['f'].strip()
        login = data['l'].strip()
        password = md5(data['p'].encode()).hexdigest()  # Хэшируем пароль
        try:
            # user = User(fullName=fullName, login=login, password=password)
            # db.session.add(user)  # Формирование запроса с использованем инструментов DB для Flask
            db.session.execute(f"INSERT INTO User ('fullName', 'login', 'password') "
                               f"VALUES ('{fullName}', '{login}', '{password}')")
            db.session.commit()
            status = '0'
        except:
            message = 'Ошибка сервера, попробуйте позже'
    r = json.dumps({'status': status, 'message': message})
    return Response(r, mimetype='application/json')


def checkSession(cookies):
    if cookies.get('Authorized'):
        return 1
    return 0


def checkAuth(login, password):
    password = md5(password.encode()).hexdigest()
    # Формирование запроса с использованем инструментов DB для Flask
    # data = User.query.filter(User.login == login, User.password == password).scalar()
    data = db.session.execute(f'SELECT * FROM User WHERE login="{login}" AND password="{password}"').scalar()
    return data


def checkData(data):  # Назначаем функции для каждого типа данных
    checkFuncMap = {'l': 'checkLogin', 'p': 'checkPassword', 'f': 'checkFullName'}
    message = []
    for k, v in data.items():  # Вызываем назначенные функции для каждого типа данных
        if k in checkFuncMap:
            message.append(globals()[checkFuncMap[k]](v))
    if message:
        message = '<br>'.join([i for i in message if i])  # Удаляем пустые значения и преобразуем в строку
    return message


def checkLogin(login):
    login = login.strip()  # Удаляем лишние пробелы
    minimumLen = 6
    message = []
    if not login:
        message.append('Не может быть пустым')
    elif len(login) < minimumLen:
        message.append(f'Слишком короткий (Мин. {minimumLen})')
    elif checkLoginExist(login):
        message.append('Уже используется')
    elif not re.fullmatch(r"^[\w-]+$", login):
        message.append('Содержит не разрешенные символы')
    if message:
        return "Логин: " + ', '.join(message)
    return 0


def checkLoginExist(login):
    return db.session.execute(f"SELECT * FROM User WHERE login='{login}'").scalar()
    # Формирование запроса с использованем инструментов DB для Flask
    # return User.query.filter(User.login == login).scalar()


def checkPassword(password):
    minimumLen = 6
    message = []
    if not password:
        message.append('Не может быть пустым')
    elif len(password) < minimumLen:
        message.append(f'Слишком короткий (Мин. {minimumLen})')
    elif not re.match(r"(?=(?:.*\d){3})", password):
        message.append('Слишком слабый, как минимум 3 цифры')
    if message:
        return "Пароль: " + ', '.join(message)
    return 0


def checkFullName(fullName):
    fullName = fullName.strip()  # Удаляем лишние пробелы
    message = []
    if not fullName:
        message.append('Не может быть пустым')
    elif re.findall(r"[\W\d]+", fullName.replace(' ', '')):
        message.append('Содержит не разрешенные символы')
    elif not re.fullmatch(r"^[a-zA-Z|А-Яа-я]+\s[a-zA-Z|А-Яа-я]+\s[a-zA-Z|А-Яа-я]+$", fullName):
        message.append('Вы должны ввести Фамилию, Имя и Отчество')
    if message:
        return "ФИО: " + ', '.join(message)
    return 0


if __name__ == '__main__':
    app.run(debug=True)
