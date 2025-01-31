(() => {
    var e = {
        151: () => {
            var e = document.querySelector(".time"), t = document.querySelector(".date"), a = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

            function i() {
                var i = new Date;

                e.innerHTML = n(i.getHours(), 2) + ":" + n(i.getMinutes(), 2) + ":" + n(i.getSeconds(), 2), t.innerHTML = n(i.getFullYear(), 4) + "-" + n(i.getMonth() + 1, 2) + "-" + n(i.getDate(), 2) + " " + a[i.getDay()]
            } function n(e, t) {
                for (var a = "", i = 0;

                    i < t;

                    i++)a += "0";
                return (a + e).slice(-t)
            } setInterval(i, 1e3), i()
        }, 49: () => { console.info("   ____             __\n  / __/_ _____ ___ / /___ _____ _/|\n _\\ \\/ // (_-</ -_) __/ // / _ > _<\n/___/\\_, /___/\\__/\\__/\\_,_/ .__//\n    /___/                /_/       \n> Systems development company.") }
    }, t = {};
    function a(i) {
        var n = t[i];
        if (void 0 !== n) return n.exports;
        var s = t[i] = { exports: {} };
        return e[i](s, s.exports, a), s.exports
    } a.n = e => {
        var t = e && e.__esModule ? () => e.default : () => e;
        return a.d(t, { a: t }), t
    }, a.d = (e, t) => { for (var i in t) a.o(t, i) && !a.o(e, i) && Object.defineProperty(e, i, { enumerable: !0, get: t[i] }) }, a.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t), (() => {
        "use strict";
        a(151), a(49)
    })()
})();

let i = 0
let j = 0
let c = 0
let interval01
let urls = []
let indexUrls = 0
let indexId = 0
const field = document.getElementById('background')
const connections = document.getElementById('connections')


fetch('https://api.getgeoapi.com/v2/ip/check?api_key=10b820f925acc9303a95cf7e709c212f2aa244e2&format=json', {
    method: "GET",
})
    .then(response => response.json())
    .then(data => geo(data))
    .catch((error) => {
        console.error('There has been a problem with your fetch operation:', error)
    })

function geo(data) {
    let firstLanguage = Object.keys(data.country.languages)[0]
    let messages = ['IP Address: ' + data.ip, 'IP Type: ' + data.type, 'ISP location latitude: ' + data.location.latitude, 'ISP location longitude: ' + data.location.longitude, 'ISP Postal code: ' + data.postcode, 'ISP area code: ' + data.area.code, 'ISP area geoname id: ' + data.area.geonameid, 'ISP Area: ' + data.area.name, 'ASN number: ' + data.asn.number, 'ASN organization: ' + data.asn.organisation, 'City geoname id: ' + data.city.geonameid, 'City name: ' + data.city.name, 'City population: ' + data.city.population, 'Continent geoname id: ' + data.continent.geonameid, 'Continent name: ' + data.continent.name, 'Data continent code: ' + data.continent.code, 'Country geonameid: ' + data.country.geonameid, 'Country name: ' + data.country.name, 'Country code: ' + data.country.code, 'Country capital: ' + data.country.capital, 'Country area size: ' + data.country.area_size, 'Country population: ' + data.country.population, 'Country phone code: ' + data.country.phone_code, 'Country languajes: ' + data.country.languages[firstLanguage], 'Country flag: ' + data.country.flag.emoji, 'Country tld: ' + data.country.tld, 'Currency code: ' + data.currency.code, 'Currency name: ' + data.currency.name, 'Use tor: ' + data.security.is_tor, 'Use proxy: ' + data.security.is_proxy, 'Use a crawler: ' + data.security.is_crawler, 'Time zone: ' + data.time.timezone, 'Time gtm_offset: ' + data.time.gtm_offset, 'Time gmt_offset: ' + data.time.gmt_offset, 'Data time code: ' + data.time.code]
    console.table(messages)
    shuffleArray(messages)
    interval01 = setInterval(typer, 123, messages)
}

function typer(messages) {
    if (messages[i].length > j) {
        connections.innerHTML += messages[i][j]
        j++
    } else {
        i++
        j = 0
        k = 0

        clearInterval(interval01)

        let interval02 = setInterval(() => {
            k++
            if (k === 3) {
                k = 0
                clearInterval(interval02)
                connections.innerHTML = " "
                interval01 = setInterval(typer, 123, messages)
            }
        }, 521)
    }

    if (messages.length === i) {
        i = 0
        clearInterval(interval01)
        interval01 = null;
        shuffleArray(messages)
    }
}

fetch('https://api.github.com/users/sysetup/repos', {
    method: "GET",
    headers: {
        Authorization: `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`
    }
})
    .then(response => response.json())
    .then(data => {
        repos(data)
    })
    .catch((error) => {
        console.error('There has been a problem with your fetch operation:', error)
    })

function repos(data) {
    data.forEach(element => {
        fetch('https://api.github.com/repos/Sysetup/' + element.name + '/contents')
            .then(response => response.json())
            .then(data => {
                contents(data, element.name)
            })
            .catch((error) => {
                console.error('There has been a problem with your fetch operation:', error);
            })
    })
}

function contents(data, name) {
    data.forEach(element => {
        let str = element.download_url
        if (element.type === 'file' && (str.slice(-2) === 'js' || str.slice(-2) === 'md' || str.slice(-2) === 'sh' || str.slice(-2) === 'ml')) {
            urls[indexUrls] = element.download_url
            indexUrls++
        } else {
            if (element.path === 'js') {
                fetch('https://api.github.com/repos/Sysetup/' + name + '/contents/js')
                    .then(response => response.json())
                    .then(data => {
                        js(data)
                    })
                    .catch((error) => {
                        console.error('There has been a problem with your fetch operation:', error)
                    })
            }
        }
    })
}

function js(data) {
    data.forEach(element => {
        urls[indexUrls] = element.download_url
        indexUrls++
    })
    gits(urls)
}

function gits(urls) {
    fetch('https://api.github.com/users/sysetup/gists')
        .then(response => response.json())
        .then(data => {
            getGitsUrl(data, urls)
        })
        .catch((error) => {
            console.error('There has been a problem with your fetch operation:', error);
        })
}

function getGitsUrl(data, urls) {
    let file
    data.forEach(element => {
        for (let i = 0; i < Object.keys(element.files).length; i++) {
            file = Object.keys(element.files)[i]
            urls[indexUrls] = element.files[file].raw_url
            indexUrls++
        }
    })

    shuffleArray(urls)
    getJSON(urls)
}

function getJSON(urls) {
    urls.forEach(element => {
        fetch(element)
            .then(response => response.text())
            .then(data => {
                settingDOM(data, urls)
            })
            .catch((error) => {
                console.error('There has been a problem with your fetch operation:', error)
            })
    })
}

function settingDOM(data, urls) {
    let html = hljs.highlightAuto(data).value
    const div = document.createElement("div")
    const divSpace = document.createElement("div")
    const id = document.createAttribute("id")
    const idSpace = document.createAttribute("id")

    indexId++
    id.value = indexId
    div.setAttributeNode(id)
    idSpace.value = 'space'
    divSpace.setAttributeNode(idSpace)
    divSpace.offsetHeight = window.innerHeight + "px" || window.screen.height + "px"
    div.innerHTML = html
    html = ""
    field.appendChild(divSpace)
    field.appendChild(div)

    if (indexId >= urls.length) {
        field.appendChild(divSpace)
        scrolling(field.scrollHeight)
    }
}

function scrolling(height) {
    let speed = 76
    let h = height - 843
    //let intervalID
    //intervalID = 
    setInterval(() => {
        if (h >= field.scrollTop) {
            field.scrollBy({
                top: +11,
                behavior: "smooth"
            })
            //console.log(`Else. MaxY: ${h} ScrollTop: ${field.scrollTop} `)
        } else {
            field.scrollTop = 0
            //console.log(`Else. MaxY: ${h} ScrollTop: ${field.scrollTop} `)
        }
    }, speed)
}

function shuffleArray(arr) {
    arr.sort(() => Math.random() - 0.5);
}

// Arreglo con cadenas de texto
var textoArray = [
    "Innovative solutions for system creation and optimization.",
    "Empowering businesses through cutting-edge system creation and optimization.",
    "Building tomorrow's success with optimized systems and creative solutions.",
    "Elevating performance through strategic system creation and optimization.",
    "Unlocking potential with optimized systems and innovative creation strategies.",
    "Driving excellence through customized system creation and optimization.",
    "Transforming possibilities into realities with advanced system creation and optimization.",
    "Creation and optimization systems.",
    "SYSETUP is a veteran in the IT industry, delivering full-cycle services in systems development for more than 18 years.",
    "For over 18 years, SYSETUP has been offering global IT solutions, specializing in full-cycle systems development services.",
    "With 18+ years of industry expertise, SYSETUP provides comprehensive IT solutions, specializing in systems development.",
    "SYSETUP is a prominent global IT solutions provider, specializing in systems development and full-cycle services with over 18 years of experience.",
    "For more than 18 years, SYSETUP has been delivering end-to-end IT solutions with a focus on systems development, establishing itself as a leading global provider.",
    "As a global IT solutions provider with over 18 years of experience, SYSETUP specializes in full-cycle services, including systems development, to meet the ever-evolving demands of the industry.",
    "SYSETUP's 18+ years of experience in the IT industry has allowed them to specialize in full-cycle services, particularly in systems development, making them a prominent global provider."
];

// Función para mostrar elemento aleatorio del arreglo
showMessage()

function showMessage() {
    // Obtener un número aleatorio entre 0 y el tamaño del arreglo - 1
    let indice = Math.floor(Math.random() * textoArray.length);

    // Obtener el elemento del arreglo con el índice aleatorio
    let randomText = textoArray[indice];

    // Mostrar el texto aleatorio en el div con el ID "randomText"
    if (randomText) {
        document.getElementById("description").innerHTML = randomText;
    }
}