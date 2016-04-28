var myMap, myGeoObjects, socket, Points, client_names, hold_center_btn, last_code, name, name_id, player_name, isWatch;

var distance_treshold = 20;

/* Array.shuffle( deep ) - перемешать элементы массива случайным образом

deep - необязательный аргумент логического типа, указывающий на то, 
       нужно ли рекурсивно обрабатывать вложенные массивы;
       по умолчанию false (не обрабатывать)
*/
Array.prototype.shuffle = function(b) {
	var i = this.length,
		j, t;
	while (i) {
		j = Math.floor((i--) * Math.random());
		t = b && typeof this[i].shuffle !== 'undefined' ? this[i].shuffle() : this[i];
		this[i] = this[j];
		this[j] = t;
	}

	return this;
};

function displayPosition(position) {
	coordsText = "Широта: " + position.coords.latitude +
		"<br> Долгота: " + position.coords.longitude +
		"<br> Точность: " + position.coords.accuracy +
		"м<br> Скорость: " + position.coords.speed * 3.6 + " км/ч" +
		"<br> Обновлено: " + (new Date(position.timestamp)).toLocaleString() + "." + (new Date(position.timestamp)).getMilliseconds() +
		"<br> Session: " + socket.socket.sessionid;

	pos = {
		coords: [position.coords.latitude, position.coords.longitude],
		description: coordsText,
		session: socket.socket.sessionid,
		player_name: player_name,
		speed: position.coords.speed * 3.6
	};
	socket.emit('coords', JSON.stringify(pos));
	console.log('Sent coords:', JSON.stringify(pos));

	if (hold_center_btn && hold_center_btn.state.get('selected')) {
		myMap.setCenter(pos.coords, myMap.getZoom(), {
			checkZoomRange: true,
			duration: 1500
		});
	}
	// myMap.setBounds(
	// 	myGeoObjects.getBounds(), {
	// 		checkZoomRange: true,
	// 		duration: 1500,
	// 		preciseZoom: true,
	// 		zoomMargin: 100
	// 	});
}

function displayBoat(position) {
	coordsText = "Широта: " + position.coords.latitude +
		"<br> Долгота: " + position.coords.longitude +
		"<br> Точность: " + position.coords.accuracy +
		"м<br> Скорость: " + position.coords.speed * 3.6 + " км/ч" +
		"<br> Обновлено: " + (new Date(position.timestamp)).toLocaleString() + "." + (new Date(position.timestamp)).getMilliseconds() +
		"<br> Session: " + socket.socket.sessionid;

	pos = {
		coords: [position.coords.latitude, position.coords.longitude],
		description: coordsText,
		session: socket.socket.sessionid,
		player_name: 'Boat',
		speed: position.coords.speed * 3.6
	};
	socket.emit('coords', JSON.stringify(pos));
	console.log('Sent coords:', JSON.stringify(pos));

	if (hold_center_btn && hold_center_btn.state.get('selected')) {
		myMap.setCenter(pos.coords, myMap.getZoom(), {
			checkZoomRange: true,
			duration: 1500
		});
	}
	// myMap.setBounds(
	// 	myGeoObjects.getBounds(), {
	// 		checkZoomRange: true,
	// 		duration: 1500,
	// 		preciseZoom: true,
	// 		zoomMargin: 100
	// 	});
}

function watchMarks() {
	if (hold_center_btn && hold_center_btn.state.get('selected')) {
		// myMap.setCenter(pos.coords, myMap.getZoom(), {
		// 	checkZoomRange: true,
		// 	duration: 1500
		// });
		myMap.setBounds(
			myMap.geoObjects.getBounds(), {
				checkZoomRange: true,
				duration: 1500,
				preciseZoom: true,
				zoomMargin: 100
			});
	}
}

function sendFakePosition(mark) {
	pos = {
		coords: {
			latitude: mark.geometry.getCoordinates()[0],
			longitude: mark.geometry.getCoordinates()[1],
			accuracy: 0,
			speed: 0
		},
		timestamp: (new Date()).getTime()
	};
	displayPosition(pos);

	//mark.events.add('dragend',sendFakePosition(mark),this);
}

// Дождёмся загрузки API и готовности DOM.
if (isWatch) {
	ymaps.ready(init_watch);
}
else {
	ymaps.ready(init);
}

function init_watch() {
	// Создание экземпляра карты и его привязка к контейнеру с
	// заданным id ("map").
	myMap = new ymaps.Map('map', {
		// При инициализации карты обязательно нужно указать
		// её центр и коэффициент масштабирования.
		center: [59.997954, 30.233932], // Спб
		zoom: 15,
		controls: ['zoomControl', 'typeSelector', 'trafficControl', 'fullscreenControl']
	}, {
		autoFitToViewport: 'always',
		maxZoom: 15
			//searchControlProvider: 'yandex#search'
	});

	hold_center_btn = new ymaps.control.Button({
		data: {
			image: 'https://' + socket.socket.options.host + '/tree/gps-01-16.png',
		},
		options: {
			selectOnClick: true,
			maxWidth: 30
				// position: {
				// 	top: 60,
				// 	left: 10
				// }
		},
		state: {
			selected: true
		}
	});

	myMap.controls.add(hold_center_btn, {
		float: 'left'
	});

	// myMap.events.add('actionbegin', function(e) {
	// 	if (hold_center_btn && hold_center_btn.state.get('selected')) {
	// 		hold_center_btn.state.set('selected', false);
	// 	}
	// });

	myMap.copyrights._clearLayout();
	myMap.copyrights._clearPromo();

	addFoxRoute();
}

function init() {
	// Создание экземпляра карты и его привязка к контейнеру с
	// заданным id ("map").
	myMap = new ymaps.Map('map', {
		// При инициализации карты обязательно нужно указать
		// её центр и коэффициент масштабирования.
		center: [59.997954, 30.233932], // Спб
		zoom: 19,
		controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
		type: 'yandex#hybrid'
	}, {
		autoFitToViewport: 'always'
	});

	// Макет кнопки должен отображать поле data.content
	// и изменяться в зависимости от того, нажата кнопка или нет.
	ButtonLayout = ymaps.templateLayoutFactory.createClass(
			'<div class="row-fluid">' +
			'<form onsubmit="return sendCodeMap(this)">' +
			'<input type="text" class="span12" id="code_on_map" placeholder="Введите ответ или код">' +
			'</form>' +
			'</div>'
		),

		button = new ymaps.control.Button({
			data: {
				//content: "Жмак-жмак"
			},
			options: {
				selectOnClick: false,
				layout: ButtonLayout,
				maxWidth: [80, 160, 300]
			}
		});

	// myMap.controls.add(button, {
	// 	float: 'left'
	// 		// position: {
	// 		// 	bottom: 0,
	// 		// 	left: 10
	// 		//}
	// });

	hold_center_btn = new ymaps.control.Button({
		data: {
			image: 'https://' + socket.socket.options.host + '/tree/gps-01-16.png',
		},
		options: {
			selectOnClick: true,
			maxWidth: 30,
			position: {
				top: 10,
				left: 10
			}
		},
		state: {
			selected: true
		}
	});

	myMap.controls.add(hold_center_btn, {
		float: 'left'
	});

	myMap.copyrights._clearLayout();
	myMap.copyrights._clearPromo();

	addFoxRoute();
}

function sendCodeMap(e) {
	console.log('Sending code:', e.elements.namedItem("code_on_map").value);
	socket.emit('code', e.elements.namedItem("code_on_map").value);
	last_code = e.elements.namedItem("code_on_map").value;
	e.elements.namedItem("code_on_map").value = "";
	return false;
}

function updatePlacemark(msg_name, msg_text, msg_isFox, msg_FoxTimer) {
	if (msg_text && msg_name == 'Boat' && hold_center_btn && hold_center_btn.state.get('selected')) {
		myMap.setCenter(JSON.parse(msg_text).coords, myMap.getZoom(), {
			checkZoomRange: true,
			duration: 1500
		});
	}


	updated = false;
	for (i = 0; i < myMap.geoObjects.getLength(); i++) {
		m = myMap.geoObjects.get(i);
		if (msg_text &&
			m.properties.get('playerID') == msg_name + '-' + JSON.parse(msg_text).session) {
			m.geometry.setCoordinates(JSON.parse(msg_text).coords);
			m.properties.set('iconContent', (name || msg_name) + ((JSON.parse(msg_text).player_name) ? ' (' + JSON.parse(msg_text).player_name + ') ' : ' ') + ': ' + Math.round(JSON.parse(msg_text).speed) + 'км/ч');
			m.properties.set('balloonContentHeader', (name || msg_name));
			m.properties.set('balloonContent', JSON.parse(msg_text).description);
			//			m.events.add('change', lookAtFox(m), this);
			updated = true;
		}
	}
	if (!updated) {
		for (i = 0; i < myGeoObjects.getLength(); i++) {
			m = myGeoObjects.get(i);
			if (msg_text &&
				m.properties.get('playerID') == msg_name + '-' + JSON.parse(msg_text).session) {
				m.geometry.setCoordinates(JSON.parse(msg_text).coords);
				m.properties.set('iconContent', (name || msg_name) + ((JSON.parse(msg_text).player_name) ? ' (' + JSON.parse(msg_text).player_name + ') ' : ' ') + ': ' + Math.round(JSON.parse(msg_text).speed) + 'км/ч');
				m.properties.set('balloonContentHeader', (name || msg_name));
				m.properties.set('balloonContent', JSON.parse(msg_text).description);
				//				m.events.add('change', lookAtFox(m), this);
				updated = true;
			}

		}
	}

	if (!updated && msg_text) {
		player = new ymaps.Placemark(JSON.parse(msg_text).coords, {
			iconContent: (name || msg_name) + ((JSON.parse(msg_text).player_name) ? ' (' + JSON.parse(msg_text).player_name + ') ' : ' ') + ': ' + Math.round(JSON.parse(msg_text).speed) + 'км/ч',
			balloonContentHeader: (name || msg_name),
			balloonContent: JSON.parse(msg_text).description,
			isPlayer: true,
			isFox: false,
			playerID: msg_name + '-' + JSON.parse(msg_text).session
		}, {
			balloonPanelMaxMapArea: 0,
			preset: "islands#blueStretchyIcon",
			draggable: true,
			//draggable: (JSON.parse(msg_text).session == socket.socket.sessionid), //заглушка для теста, потом убрать, иначе все пользователи смогут таскать свои меркеры
			//draggable: (!JSON.parse(msg_text).player_name && JSON.parse(msg_text).session == socket.socket.sessionid), //только если юзер не определен и только свою сессию
			openEmptyBalloon: true
		});
		player.events.add('geometrychange', function(e) {
			lookAtFox(e.get('target'));
		});
		//lookAtFox(player), this);

		if (JSON.parse(msg_text).session == socket.socket.sessionid) {
			player.events.add('dragend', function(e) {
				sendFakePosition(e.get('target'));
			});
			myGeoObjects.add(player);
			lookAtFox(player);
		}
		else {
			myMap.geoObjects.add(player);
			lookAtFox(player);
		}
	}

	//document.getElementById('debug-text').innerHTML = 'GeoObj: ' + myMap.geoObjects.getLength() + ' MyObj: ' + myGeoObjects.getLength() + ' Clients: ' + String(!client_names || client_names.length);
}

function lookAtFox(playerMark) {
	p_updated = false;

	Points.forEach(function(point) {
		if (p_updated) {
			return;
		}

		if (point) {
			tree = point.geoObject;
		}
		else {
			tree = undefined;
		}

		if (tree) {
			distance = tree.getMap().options.get('projection').getCoordSystem().getDistance(playerMark.geometry.getCoordinates(), tree.geometry.getCoordinates());

			// if (distance < distance_treshold && point.isActive) {
			if (distance < distance_treshold) {
				point.isActive = false;
				updatePoint(point);
				
				playerMark.options.set('preset', "islands#redStretchyIcon");

				p_updated = false;
				myMap.geoObjects.each(function(m) {
					if (m.geometry &&
						m.geometry.getType() == 'Circle' &&
						m.properties.get('playerID') == playerMark.properties.get('playerID')) {
						m.geometry.setCoordinates(playerMark.geometry.getCoordinates());
						p_updated = true;
					}
				}, this);
				myGeoObjects.each(function(m) {
					if (m.geometry &&
						m.geometry.getType() == 'Circle' &&
						m.properties.get('playerID') == playerMark.properties.get('playerID')) {
						m.geometry.setCoordinates(playerMark.geometry.getCoordinates());
						p_updated = true;
					}
				}, this);

				if (!p_updated) {
					circleMark = new ymaps.Circle(
						[playerMark.geometry.getCoordinates(),
							distance_treshold
						], {
							isPlayer: true,
							isFox: false,
							playerID: playerMark.properties.get('playerID')
						}, {
							//balloonPanelMaxMapArea: 0,
							draggable: false,
							zIndex: 10,
							zIndexHover: 10,
							// Цвет заливки.
							// Последний байт (77) определяет прозрачность.
							// Прозрачность заливки также можно задать используя опцию "fillOpacity".
							fillColor: "#DB709377", //красный
							strokeColor: "#990066",
							//
							//fillColor: '#ff663377', //рыжий
							//strokeColor: "#cc3300",
							//
							//fill: true,
							//fillMethod: stretch,
							//fillImageHref: 'car/10.png',
							fillOpacity: 0.3,
							//strokeColor: "#cc3300", //цвет обводки (рыжий)
							strokeOpacity: 0.5, // Прозрачность обводки.
							strokeWidth: 5 // Ширина обводки в пикселях.
						});

					if (circleMark.properties.get('playerID').search(socket.socket.sessionid) >= 0) {
						myGeoObjects.add(circleMark);
						p_updated = true;
					}
					else {
						//рисовать или нет не свои отметки о поимке лисы
						tree.getMap().geoObjects.add(circleMark);
						p_updated = true;
					}
				}
			}
			else {
				point.isActive = true;
				updatePoint(point);

				playerMark.options.set('preset', "islands#blueStretchyIcon");
				tree.getMap().geoObjects.each(function(m) {
					if (m.geometry &&
						m.geometry.getType() == 'Circle' &&
						m.properties.get('playerID') == playerMark.properties.get('playerID')) {
						tree.getMap().geoObjects.remove(m);
					}
				}, this);
				myGeoObjects.each(function(m) {
					if (m.geometry &&
						m.geometry.getType() == 'Circle' &&
						m.properties.get('playerID') == playerMark.properties.get('playerID')) {
						myGeoObjects.remove(m);
					}
				}, this);
			}
		}
	});
}

function removePlacemark(a) {
	for (i = 0; i < myMap.geoObjects.getLength(); i++) {
		m = myMap.geoObjects.get(i);
		if (m.properties.get('playerID').search(a) >= 0 &&
			m.properties.get('isPlayer')) {
			myMap.geoObjects.remove(m);
		}
	}
	for (i = 0; i < myGeoObjects.getLength(); i++) {
		m = myGeoObjects.get(i);
		if (m.properties.get('playerID').search(a) >= 0 &&
			m.properties.get('isPlayer')) {
			myGeoObjects.remove(m);
		}
	}
}

function removePlacemark_one(a) {
	for (i = 0; i < myMap.geoObjects.getLength(); i++) {
		m = myMap.geoObjects.get(i);
		if (m.properties.get('playerID') == a &&
			m.properties.get('isPlayer')) {
			myMap.geoObjects.remove(m);
		}
	}
	for (i = 0; i < myGeoObjects.getLength(); i++) {
		m = myGeoObjects.get(i);
		if (m.properties.get('playerID') == a &&
			m.properties.get('isPlayer')) {
			myGeoObjects.remove(m);
		}
	}
}

function checkPlacemarks(placemark_names) {
	for (i = 0; i < myMap.geoObjects.getLength(); i++) {
		m = myMap.geoObjects.get(i);
		if (m.geometry &&
			(m.geometry.getType() == "Point" || m.geometry.getType() == "Circle") &&
			m.properties.get('isPlayer') &&
			!placemark_names.find(function(element, index, array) {
				return element.name + '-' + element.id == m.properties.get('playerID');
			})) {
			myMap.geoObjects.remove(m);
		}
	}
	for (i = 0; i < myGeoObjects.getLength(); i++) {
		m = myGeoObjects.get(i);
		if (m.geometry &&
			(m.geometry.getType() == "Point" || m.geometry.getType() == "Circle") &&
			m.properties.get('isPlayer') &&
			!placemark_names.find(function(element, index, array) {
				return element.name + '-' + element.id == m.properties.get('playerID');
			})) {
			myGeoObjects.remove(m);
		}
	}
}

function addFoxRoute() {

	myGeoObjects = new ymaps.GeoObjectCollection();

	myMap.geoObjects.add(myGeoObjects);

	updatePoints(Points);

	if (client_names) {
		client_names.forEach(function(e) {
			if (e.name && e.name !== 'Anonymous') {
				updatePlacemark(e.name, e.last_data);
			}
		});
	}
	else {
		socket.emit('request_roaster', '');
	}

}

function lookAtPlayers(foxMark) {
	myMap.geoObjects.each(function(player) {
		if (player.properties.get('isPlayer')) {
			lookAtFox(player);
		};
	});
	myGeoObjects.each(function(player) {
		if (player.properties.get('isPlayer')) {
			lookAtFox(player);
		};
	});
}

function updatePoints(points) {
	Points = [].concat(points);
	Points.forEach(function(point) {
		if (point) {
			updatePoint(point);
			lookAtPlayers(point.geoObject);
		}
	});
}

function updatePoint(point) {
	updated = false;
	for (i = 0; i < myMap.geoObjects.getLength(); i++) {
		m = myMap.geoObjects.get(i);
		if (m.properties.get('treeID') == point.name) {
			m.geometry.setCoordinates(point.coords);
			m.properties.set('isActive', point.isActive);
			m.properties.set('Team', point.Team);
			m.properties.set('Team_id', point.Team_id);
			m.properties.set('ActivateCode', point.ActivateCode);
			m.properties.set('description', point.description);
			point.geoObject = m;
			updated = true;
		}
	}
	if (!updated) {
		for (i = 0; i < myGeoObjects.getLength(); i++) {
			m = myGeoObjects.get(i);
			if (m.properties.get('treeID') == point.name) {
				m.geometry.setCoordinates(point.coords);
				m.properties.set('isActive', point.isActive);
				m.properties.set('Team', point.Team);
				m.properties.set('Team_id', point.Team_id);
				m.properties.set('ActivateCode', point.ActivateCode);
				m.properties.set('description', point.description);
				point.geoObject = m;
				updated = true;
			}
		}
	}

	if (!updated) {
		tree = new ymaps.Placemark(point.coords, {
			isPlayer: false,
			isTree: true,
			isActive: point.isActive,
			treeID: point.name,
			Team: point.Team,
			Team_id: point.Team_id,
			ActivateCode: point.ActivateCode,
			description: point.description
		}, {
			balloonPanelMaxMapArea: 0,
			draggable: true,
			//			preset: (point.isActive) ? "islands#greenStretchyIcon" : "islands#grayStretchyIcon",
			openEmptyBalloon: true,
			iconLayout: ymaps.templateLayoutFactory.createClass(
				//'<div class="b-info-container"><div class="b-tree b-tree-$[properties.isActive]"></div><div class="b-info b-info-$[properties.isActive]">{{properties.treeID}}<br>{% if !properties.isActive %}Команда: {{properties.Team}}{% endif %}</div></div>'
				'<div class="b-placemark-container">' +
				'<div class="b-placemark">' +
				'<div class="b-container">' +
				'<div class="b-icon-container">' +
				'<div class="b-icon b-icon-$[properties.isActive]">' +
				'</div>' +
				'</div>' +
				'<div class="b-info-container">' +
				'<div class="b-info b-info-$[properties.isActive]">' +
				//'{{properties.treeID}}<br>'+
				'{% if !properties.isActive %}' +
				//'{% if (properties.Team_id !== \'\') %}' +
				'CP:{{properties.ActivateCode}}' +
				// 'уже снято вашей командой' +
				// '{% else %}' +
				// 'Команда: {{properties.Team}}' +
				// '{% endif %}' +
				'{% else %}' +
				'{{properties.description}}' +
				'{% endif %}' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>'
			)
		});

		point.geoObject = tree;
		myMap.geoObjects.add(tree);
		updated = true;
	}

	if (point.ConfirmCode !== '' &&
		last_code &&
		last_code !== '' &&
		point.ConfirmCode.indexOf(last_code.toLowerCase()) >= 0 &&
		document.getElementsByName("LevelAction.Answer").length > 0) {
		document.getElementsByName("LevelAction.Answer")[0].value = point.ActivateCode.toLowerCase();
		document.getElementsByName("LevelAction.Answer")[0].parentElement.submit();
	}
	//document.getElementById('debug-text').innerHTML = 'GeoObj: ' + myMap.geoObjects.getLength() + ' MyObj: ' + myGeoObjects.getLength() + ' Clients: ' + String(!client_names || client_names.length);
}