

function setupTypeWriter(data) {
    let field = document.getElementById('background')
    let speed = 1
    let index = 0
    data = data.replaceAll(';', ';\n\n')
    setInterval(() => {
        if (data.length > index) {
            field.innerHTML += data[index]
            field.scrollTop += 11;
            index++
            hljs.highlightAll();
        } else {
            index = 0
            //clearInterval(intervalID)
        }
    }, speed)
}