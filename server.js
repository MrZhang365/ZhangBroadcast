const websocket = require('ws')
const readline = require('readline-sync')

var clients = []
var banned = []
var locked = false

var server = new websocket.Server({
    port:12345
})

server.on('error',(err) => {
    console.error(`Server error: ${err}`)
    process.exit(1)
})

server.on('connection',(socket,req) => {
    clients.push(socket)
    console.info(`${socket.ip} connected.`)
    socket.ip = (/* req.headers['X-Forwarded-for'] || */ req.connection.remoteAddress).replace('::ffff:','')
    if (banned.indexOf(socket.ip) !== -1){
        reply({
            cmd:'info',
            text:'Sorry, the broadcaster banned your IP address.'
        },socket)
        socket.banned = true
        return socket.terminate()
    }
    if (locked){
        reply({
            cmd:'info',
            text:'Sorry, the broadcaster locked this server.'
        },socket)
        socket.banned = true
        return socket.terminate()
    }
    
    broadcast({
        cmd:'info',
        text:`${socket.ip} joined.`
    },true)
    if (!broadcasterIn()){
        reply({
            cmd:'info',
            text:'The broadcaster is not here yet. Please wait a moment.'
        },socket)
    }
    reply({
        cmd:'info',
        text:`Number of online users: ${clients.length}`
    },socket)
    socket.on('error',(err) => {
        console.error(`Client error: ${err}`)
        socket.terminate()
    })
    socket.on('close',(code,reason) => {
        clients = clients.filter((client) => client !== socket)
        console.info(`${socket.ip} disconnected.`)
        socket.terminate()
        if (socket.banned){
            return
        }
        broadcast({
            cmd:'info',
            text:`${socket.ip} left.`
        },true)
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
                text:'You are already logined.'
            },socket)
            return socket.terminate()
        }
        if (args.password === password){
            broadcast({
                cmd:'info',
                text:'The broadcaster logined.'
            },false)
            sendToBroadCaster({
                cmd:'info',
                text:`A broadcaster logined, IP address is ${socket.ip}`
            })
            socket.broadcaster = true
        }else{
            reply({
                cmd:'info',
                text:'Password error, please try again.'
            },socket)
        }
    },
    star: function(socket,args){
        if (socket.broadcaster){
            return reply({
                cmd:'info',
                text:'Broadcasters can\'t star anyone.'
            },socket)
        }
        broadcast({
            cmd:'info',
            text:`${socket.ip} stared the broadcaster.`
        },true)
    },
    broadcast: function(socket,args){
        if (!socket.broadcaster){
            return reply({
                cmd:'info',
                text:'You are not a broadcaster.'
            },socket)
        }
        if (!args.text){
            return reply({
                cmd:'info',
                text:'So what do you want to say?'
            },socket)
        }
        if (args.text === '!exit'){
            if (!socket.broadcaster){
                return reply({
                    cmd:'info',
                    text:'Are you kidding?'
                },socket)
            }
            broadcast({
                cmd:'info',
                text:'The broadcast closed this server.'
            },true)
            exit()
            return
        }
        if (args.text.split(' ')[0] === '!kick'){
            const ip = args.text.split(' ')[1]
            if (!ip){
                return reply({
                    cmd:'info',
                    text:'So, who should I kick?'
                },socket)
            }
            if (!socket.broadcaster){
                return reply({
                    cmd:'info',
                    text:'I think I should kick you out.'
                },socket)
            }
            var targetSockets = clients.filter((s) => s.ip === ip)
            if (targetSockets.length === 0){
                return reply({
                    cmd:'info',
                    text:'But I can\' find that user.'
                },socket)
            }
            var i = 0
            broadcast({
                cmd:'info',
                text:`Kicked ${ip}`
            },true)
            for (i in targetSockets){
                reply({
                    cmd:'info',
                    text:'You have been kicked out.'
                },targetSockets[i])
                targetSockets[i].terminate()
            }
            return
        }
        if (args.text.split(' ')[0] === '!ban'){
            const ip = args.text.split(' ')[1]
            if (!ip){
                return reply({
                    cmd:'info',
                    text:'So, who should I ban?'
                },socket)
            }
            if (!socket.broadcaster){
                return reply({
                    cmd:'info',
                    text:'I think I should ban you.'
                },socket)
            }
            var targetSockets = clients.filter((s) => s.ip === ip)
            if (targetSockets.length === 0){
                return reply({
                    cmd:'info',
                    text:'But I can\' find that user.'
                },socket)
            }
            var i = 0
            banned.push(ip)
            broadcast({
                cmd:'info',
                text:`Banned ${ip}`
            },true)
            for (i in targetSockets){
                reply({
                    cmd:'info',
                    text:'Broadcaster banned you.'
                },targetSockets[i])
                targetSockets[i].terminate()
            }
            return
        }
        if (args.text === '!lock'){
            if (!socket.broadcaster){
                return reply({
                    cmd:'info',
                    text:'Are you kidding?'
                },socket)
            }
            broadcast({
                cmd:'info',
                text:'The broadcaster locked this server.'
            },true)
            locked = true
            return
        }
        if (args.text === '!unlock'){
            if (!socket.broadcaster){
                return reply({
                    cmd:'info',
                    text:'Are you kidding?'
                },socket)
            }
            broadcast({
                cmd:'info',
                text:'The broadcaster unlocked this server.'
            },true)
            locked = false
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