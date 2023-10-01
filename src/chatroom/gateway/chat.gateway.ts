import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Socket, Server } from 'socket.io';

@WebSocketGateway()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor() {}
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ChatGateway');

  @SubscribeMessage('enter')
  handleEnter(@MessageBody() data: string): string {
    this.logger.log('enter');
    return data;
  }
    
  // @SubscribeMessage('events')
  // handleEvent(@MessageBody() data: string): string {
  //   this.logger.log('events');
  //   return data;
  // }

  private broadcast(event, client, message: any) {
    console.log(`broadcast`);
    for (let id in this.server.sockets)
      if (id !== client.id) this.server.sockets[id].emit(event, message);
  }

  @SubscribeMessage('newMessage')
  sendMessage(@MessageBody() data: string, @ConnectedSocket() client) {
    const [room, nickname, message] = data;
    console.log(`${client.id} : ${data}`);
    this.server.emit('newMessage', data)
    this.broadcast(room, client, [nickname, message]);
  }
  
  afterInit(server: Server) {
    this.logger.log('Init');

  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client Disconnected : ${client.id}`);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client Connected : ${client.id}`);
  }
}
