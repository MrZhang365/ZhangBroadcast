const websocket = require('ws')
const readline = require('readline-sync')

var clients = []

var server = new websocket.Server({
    port:12345
})

server.on('error',(err) => {
    console.error(`Server error: ${err}`)
    process.exit(1)
})

server.on('connection',(socket,req) => {
    clients.push(socket)
    socket.ip = /* req.headers['X-Forwarded-for'] || */ req.connection.remoteAddress
    console.info(`${socket.ip} joined`)
    sendToBroadCaster({
        cmd:'info',
        text:`${socket.ip} joined`
    })
    if (!broadcasterIn()){
        reply({
            cmd:'info',
            text:'The broadcaster is not here yet. Please wait a moment.'
        },socket)
    }
    socket.on('error',(err) => {
        console.error(`Client error: ${err}`)
        socket.terminate()
    })
    socket.on('close',(code,reason) => {
        clients = clients.filter((client) => client !== socket)
        console.info(`${socket.ip} left`)
        sendToBroadCaster({
            cmd:'info',
            text:`${socket.ip} left`
        })
        socket.terminate()
    })
    socket.on('message',(data,isBin) => {
        if (isBin){
            return socket.terminate()
        }
        const text = data.toString()
        try{
            var payload = JSON.parse(text)
        }catch(Err){
            return socket.terminate()
        }
        var cmd = payload.cmd
        if (!cmd){
            return socket.terminate()
        }
        if (typeof COMMANDS[cmd] !== 'function'){
            return reply({
                cmd:'info',
                text:'What should I do?'
            },socket)
        }
        COMMANDS[cmd](socket,payload)

    })
})

function reply(payload,socket){
    socket.send(JSON.stringify(payload))
}

const COMMANDS = {
    login: function(socket,args){
        if (socket.broadcaster){
            reply({
                cmd:'info',
                text:'You are already logined'
            },socket)
            return socket.terminate()
        }
        if (args.password === password){
            broadcast({
                cmd:'info',
                text:'The broadcaster logined'
            },false)
            sendToBroadCaster({
                cmd:'info',
                text:`A broadcaster logined, IP address is ${socket.ip}`
            })
            socket.broadcaster = true
        }else{
            reply({
                cmd:'info',
                text:'Password error, please try again'
            },socket)
        }
    },
    star: function(socket,args){
        if (socket.broadcaster){
            return reply({
                cmd:'info',
                text:'Broadcasters can\'t star anyone'
            },socket)
        }
        broadcast({
            cmd:'info',
            text:`${socket.ip} stared the broadcaster`
        },true)
    },
    broadcast: function(socket,args){
        if (!socket.broadcaster){
            return reply({
                cmd:'info',
                text:'You are not a broadcaster'
            },socket)
        }
        if (!args.text){
            return reply({
                cmd:'info',
                text:'So what do you want to say?'
            },socket)
        }
        if (args.text === '!exit'){
            broadcast({
                cmd:'info',
                text:'The broadcast closed this server.'
            },true)
            exit()
            return
        }
        broadcast({
            cmd:'broadcast',
            text:args.text
        },false)
    },
}

setInterval(() => {
    var i = 0
    for (i in clients){
        clients[i].ping()
    }
},30000)

function sendToBroadCaster(payload){
    var i = 0
    for (i in clients){
        if (clients[i].broadcaster){
            reply(payload,clients[i])
        }
    }
}

function broadcasterIn(){
    var i = 0
    for (i in clients){
        if (clients[i].broadcaster){
            return true
        }
    }
    return false
}

function broadcast(payload,toBroadCaster = false){
    var i = 0
    for (i in clients){
        if (clients[i].broadcaster && !toBroadCaster){
            continue
        }
        reply(payload,clients[i])
    }
}

function exit(){
    var i = 0
    for (i in clients){
        clients[i].terminate()
    }
    process.exit(0)
}

const password = readline.question('Please set your password: ')
//const password = '20080314'
if (!password){
    console.warn(`This is not a password.`)
    exit()
}