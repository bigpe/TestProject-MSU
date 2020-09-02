function Onload() {

}

function RegistrationForm() {
	document.getElementById("popup_body").style.visibility = 'visible'
	document.getElementById("popup").style.visibility = 'visible'
	document.getElementById("show_reg").style.visibility = 'hidden'
	document.getElementById("info").innerHTML = ''
}

function Popup_close() {
	document.getElementById("popup").style.visibility = 'hidden'
	document.getElementById("popup_body").style.visibility = 'hidden'
	document.getElementById("show_reg").style.visibility = 'visible'
	document.getElementById("popup_info").innerHTML = ''
	document.getElementById("FIO").value = ''
	document.getElementById("n_login").value = ''
	document.getElementById("n_password").value = ''
}

function Register() {
	let FIO = document.getElementById("FIO").value
	let login = document.getElementById("n_login").value
	let password = document.getElementById("n_password").value
	
	let csrf_token = document.getElementById('csrf_token').value
	
	$.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrf_token);
            }
        }
    });

	$.ajax({
	contentType: "application/json",
	url:"/reg",
	type: "POST",
	data: JSON.stringify({f: FIO, l: login, p: password})
	}).done(function(result) {
		if(result.status=='0') {
			Popup_close()
			document.getElementById("info").innerHTML = result.message
		}
		else {
			document.getElementById("popup_info").innerHTML = result.message
		}
	})
}

function Check_auth() {
	let login = document.getElementById("login").value
	let password = document.getElementById("password").value
	
	let csrf_token = document.getElementById('csrf_token').value
	
	$.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrf_token);
            }
        }
    });

	$.ajax({
	contentType: "application/json",
	url:"/pre_signin",
	type: "POST",
	data: JSON.stringify({l: login, p: password})
	}).done(function(result) {
		if(result.status=='0') {
			document.getElementById("info").innerHTML = result.message
			document.getElementById("r_login").value = login
			document.getElementById("r_password").value = password
			document.getElementById("auth_form").submit()
		}
		else {
			document.getElementById("info").innerHTML = result.message
		}
	})
}