from websocket import WebSocketApp as websocketapp
from json import loads,dumps
from _thread import start_new_thread as start

URL = input('I want to connect this server: ')
PASSWORD = input('My password is: ')

if not URL:
    print('This is not a url')
    exit()

def on_error(ws,err):
    print(f'Client error: {err}')
    ws.close()
    exit()

def on_close(ws, close_status_code, close_msg):
    print('Connection closed')
    exit()

def on_open(ws):
    print('Connected')
    websocket.send(dumps({
        'cmd':'login',
        'password':PASSWORD
    }))
    def star():
        while True:
            TEXT = input('I want to say: ')
            websocket.send(dumps({'cmd':'broadcast','text':TEXT}))
    start(star,())


def on_message(ws,message):
    payload = loads(message)
    if payload['cmd'] == 'info':
        print('\nServer: '+payload['text'])
    elif payload['cmd'] == 'broadcast':
        print('Broadcaster: '+payload['text'])

websocket = websocketapp(url=URL,on_close=on_close,on_open=on_open,on_error=on_error,on_message=on_message)
websocket.run_forever()