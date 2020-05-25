var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

let curUID = 0;

app.use(express.static('public'));

var Game = {
  player1 : [],
  player2 : [],
  player1pile : [],
  player2pile : [],
  pile : [],
  curPlayer : "player1",
  isReady : false
}

function generatePile(){
  for(var i = 1; i <= 4; i++){
    for(var j = 1; j <= 13; j++){
      Game.pile.push("c" + i + (("0" + j).slice(-2)));
    }
  }
}

function shufflePile(){
  for(var i = 0; i < 100; i++){
    let p1 = Math.floor(Math.random() * Game.pile.length);
    let p2 = Math.floor(Math.random() * Game.pile.length);
    let temp = Game.pile[p1]
    Game.pile[p1] = Game.pile[p2];
    Game.pile[p2] = temp;
  }
}

function draw(){
  return Game.pile.pop();
}

function drawAll(){
  for(var i = 0; i < 5; i++){
    Game.player1.push(draw());
    Game.player2.push(draw());
  }
}

generatePile();
shufflePile();
drawAll();

var users = [];

function cardVal(c){
  switch(c){
    case '01':
      return "Two";
    case '02':
      return "Three";
    case '03':
      return "Four";
    case '04':
      return "Five";
    case '05':
      return "Six";
    case '06':
      return "Seven";
    case '07':
      return "Eight";
    case '08':
      return "Nine";
    case '09':
      return "Ten";
    case '10':
      return "Jack";
    case '11':
      return "Queen";
    case '12':
      return "King";
    case '13':
      return "Ace";
    default:
      return "Invalid";
  }
}

function pileCards(){
  let msg = "";
  for(var i = 0; i < Game.player1.length; i++){
    let val = Game.player1[i].substring(2,4);
    let count = 1;
    for(var j = i+1; j < Game.player1.length; j++){
      let v = Game.player1[j].substring(2,4);
      if(v == val)
        count++;
    }

    if(count == 4){
      msg += "Picked up a full set of " + cardVal(val) + "s. ";
      for(var j = 0; j < Game.player1.length; j++){
        let v = Game.player1[j].substring(2,4);
        if(v == val){
          Game.player1pile.push(Game.player1[j]);
          Game.player1.splice(j,1);
          j--;
        }
      }
      i--;
    }
  }

  for(var i = 0; i < Game.player2.length; i++){
    let val = Game.player2[i].substring(2,4);
    let count = 1;
    for(var j = i+1; j < Game.player2.length; j++){
      let v = Game.player2[j].substring(2,4);
      if(v == val)
        count++;
    }
    if(count == 4){
      msg += "Picked up a full set of " + cardVal(val) + "s. ";
      for(var j = 0; j < Game.player2.length; j++){
        let v = Game.player2[j].substring(2,4);
        if(v == val){
          Game.player2pile.push(Game.player2[j]);
          Game.player2.splice(j,1);
          j--;
        }
      }
      i--;
    }
  }
  alert(msg);
}

function executeCard(card,player){
  let found = false;
  if(player == "player1"){
    for(var i = 0; i < Game.player2.length; i++){
      if(Game.player2[i].substring(2,4) == card.substring(2,4)){
        Game.player1.push(Game.player2[i]);
        Game.player2.splice(i,1);
        i--; 
        found = true;
      }
    }
    if(!found)
      Game.player1.push(draw());
  }

  if(player == "player2"){
    let found = false;
    for(var i = 0; i < Game.player1.length; i++){
      if(Game.player1[i].substring(2,4) == card.substring(2,4)){
        Game.player2.push(Game.player1[i]);
        Game.player1.splice(i,1);
        i--; 
        found = true;
      }
    }
    if(!found)
      Game.player2.push(draw());
  }
}

function updatePileValues(){
  io.emit("PileValue", Game.player1pile.length, Game.player2pile.length);
}

function showPiles(){
  io.emit("ShowPiles", Game.player1pile, Game.player2pile);
}

function alert(msg){
  io.emit("Alert",msg);
}

function updateBoards(){
  users.forEach(u => {
    if(u.playerType == "player1"){
      u.socket.emit('GameData',Game.player2.length,Game.player1);
    }else if(u.playerType == "player2"){
      u.socket.emit('GameData',Game.player1.length,Game.player2);
    }else{
      u.socket.emit('GameData',Game.player1.length,Game.player2,Game.player1);
    }
  });
}

function updateTurn(){
  for(var i = 0; i < users.length; i++){
    users[i].socket.emit("CurrentTurn",Game.curPlayer);
  }
}

io.on('connection', (socket) => {
  let user = -1;
  socket.on('OnClick', function(card){
    if(users[user] == undefined)
      return;
    if(users[user].playerType == "spectator")
      return;
    else if(users[user].playerType == Game.curPlayer){
      executeCard(card,users[user].playerType);
      pileCards();
      updateBoards();
      Game.curPlayer = Game.curPlayer == "player1" ? "player2" : "player1";
      updateTurn();
      updatePileValues();
      if(Game.player1.length == 0 || Game.player2.length == 0)
        showPiles();
    }
  });

  socket.on('SendUID', function(uid){

    let position = -1;
    for(var i = 0; i < users.length; i++){
      if(users[i].id == uid){
        users[i].socket.emit("Disconnect","Logged in from a different location.");
        users[i].socket.disconnect();
        users[i].socket = socket;
        user = i;
        position = i;
        break;
      }
    }

    let id;
    if(uid == null || position == -1)
      id = ++curUID;
    else
      id = uid;

    let playerType = "spectator";
    if(id == 1)
      playerType = "player1";
    else if(id == 2)
      playerType = "player2";

    if(position == -1){
      user = users.length;
      users.push({id: id, socket: socket, playerType : playerType});
    }

    socket.emit("UID",id,playerType);

    if(playerType == "player1")
      socket.emit('GameData',Game.player2.length,Game.player1);
    else if(playerType == "player2")
      socket.emit('GameData',Game.player1.length,Game.player2);
    else
      socket.emit('GameData',Game.player1.length,Game.player2,Game.player1);

    if(Game.isReady)
      socket.emit('IsReady',Game.isReady);

    socket.emit("CurrentTurn",Game.curPlayer);

    console.log("User connected with UID" + id + "!");

    if(users.length >= 2){
      Game.isReady = true;
      io.emit('IsReady',Game.isReady);
    }
  })
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});