import {interval,fromEvent,range} from 'rxjs'
import {merge,map,scan} from 'rxjs/operators'

function pong() {
  //State is this game whole status. It is a readonly type, which can only be declared.
  //It consist of paddle1, paddle2, ball positions, keep track off goal counters of player and computer to show restart message,
  //and keep track of bullet and enemy that are spawn on this game.
  type State = Readonly<{
    xPad1: number; //player's paddle x position
    yPad1: number; //player's paddle y position
    xPad2: number; //computer's paddle x position
    yPad2: number; //computer's paddle y position
    xBall: number; //ball's x position
    yBall: number; //ball's y position
    degree: number; //ball's direction degree
    goalCounter1: number; //player's life
    goalCounter2: number; //computer's life
    zHeart:Array<number> //hearts display (z-index)
    topHeart:Array<number> //hearts display (y)
    retryMsg: String //text that asked player to press enter to retry
    fillBox: String //textbox's colour
    text: String //result's text
    bullet:Array<Body> //array of bullets that are currently/going to be on the canvas
    enemy:Array<Body> //array of enemies that are currently/going to be on the canvas
    random: number;
  }>

  //This type is for object such as Enemy and Bullet.
  //It consists of the object position and a state that indicate whether the object has expired or not.
  //Object is determined as expired if it they both collided or it got out of the canvas boundary.
  type Body = Readonly<{
    id: String
    x: number
    y: number
    expired: boolean
  }>

  class ballMove { constructor() {} } //class that will create a state to move the ball
  class pad1Move { constructor(public readonly y:number) {} } //class that will create a state to move the player's paddle
  class pad2Move { constructor() {} } //class that will create a state to move the computer's paddle
  class Shoot { constructor() {} } //class that will create a state of shoot-a-bullet action
  class Tick { constructor() {} } //class that will create a state that move all objects (enemies and bullets)
  class spawner { constructor() {}} //class that will create a state that add(spawn) enemy to the canvas
  class enemyFilter {constructor() {}} //class that will create a state which have all colliding objects removed
  class hit { constructor() {}} //class that will create a state after shooting action (will make object's expired true if it collided)
  class enter {constructor(){}} //class that will create a state that will restart the game if enter is pressed
  class doNothing{constructor(){}} //class that will create a state exactly like before

  //generate random number according to the seed
  //this class is cited from Workshop4 Observable.ts file
  class RNG {
    // LCG using GCC's constants
    m = 0x80000000// 2**31
    a = 1103515245
    c = 12345
    state:number
    constructor(seed: number) {
      this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
    }
    nextInt() {
      this.state = (this.a * this.state + this.c) % this.m;
      return this.state;
    }
    nextFloat() {
      // returns in range [0,1]
      return this.nextInt() / (this.m - 1);
    }
  }

  const svg = document.getElementById("canvas")!;

  //This function will convert a degree into x rate and y rate according to trigonometry rule.
  function degreeConverter(deg:number){
    const xRate = deg==30||deg==330?4:(deg==150||deg==210?-4:(deg<90||deg>270?2:-2))
    const yRate = deg==60||deg==120?4:(deg==240||deg==300?-4:(deg<180?2:-2))
    return [xRate,yRate]
  }

  //A function to check whether the given ball is hit by given paddle at the parameter.
  //It will check by the ball's y and paddle's y. If the ball's y is in between of paddle's y and (paddle's y + height), it return true else false.
  function hitThePaddle(ballY:number,paddleY:number){
    return (ballY>=paddleY) && (ballY<=paddleY+(60))
  }

  //Function that will take a state and return a new updated state with updated ball position
  function calculateBallPosition (s:State):State{
    const [a,b] = degreeConverter(s.degree)
    //If the state given is emptyState (it is waiting for user to press enter to retry), do not change the ball position and return initial state directly
    if (s.retryMsg.length>0){return s}
    //If ball reached the left-end, check whether player's paddle hit the ball, if yes reflect the ball, if no reset the state
    if (a+s.xBall<=10){
        return hitThePaddle(s.yBall,s.yPad1)?calculateBallPosition({...s,degree:180-s.degree}):resetedState(s,0,1)
    }
    //If ball reached the right-end, check whether computer's paddle hit the ball, if yes reflect the ball, if no reset the state
    else if (a+s.xBall>=885){
        return hitThePaddle(s.yBall,s.yPad2)?calculateBallPosition({...s,degree:180-s.degree}):resetedState(s,1,0)
    }
    else{
      //If the ball does not hit the horizontal wall, updated the position according to the current degree
      if (b+s.yBall>=10 && b+s.yBall<=480){
        return {...s,xBall:a+s.xBall,yBall:b+s.yBall}
      } 
      //If the ball hit the horizontal wall, call the function again with updated degree
      else{
        return calculateBallPosition({...s,degree:360-s.degree})
      }
    }
  }

  //Function that will return a reseted state when ball has reached the goal
  //Ball will respawn from middle ,computer's paddle will start from the initial position and heart will decreased by 1.
  //This function will also check whether the game has ended or not by taking parameters of who scored in this round (if no one score then both 0)
  //If the game has ended, it will delete all enemies and bullets from the canvas, display the result and return an emptyState
  function resetedState (s:State,score1:number,score2:number):State {
    const index = score2==1?s.goalCounter1:s.goalCounter2+7
    const end = s.goalCounter1-score2<=0 || s.goalCounter2-score1<=0
    //If the state given is emptyState (it is waiting for user to press enter to retry), do not change the ball position and return initial state directly
    if (s.retryMsg.length>0){return s}
    //When the game has ended
    if (end){
      s.enemy.forEach((e)=>svg.removeChild(document.getElementById(String(e.id))))
      s.bullet.forEach((e)=>svg.removeChild(document.getElementById(String(e.id))))
      const state = emptyState
      return s.goalCounter1-score2==0? {...state,text:"YOU LOSE"}:{...state,text:"YOU WIN"}
    }
    return {...s,
      xPad2: 885,
      yPad2: 250,
      xBall: 500,
      yBall: 250,
      degree: (((Math.floor(Math.abs(s.random) * Math.floor(3))+1)*2)+1)*45,
      goalCounter1: s.goalCounter1-score2,
      goalCounter2: s.goalCounter2-score1,
      zHeart: s.zHeart.slice(0,index-1).concat([-1],s.zHeart.slice(index,14)),
      topHeart: s.topHeart.slice(0,index-1).concat([110],s.topHeart.slice(index,14)),
    }
  }

  //This function is for when the enemy has entered the goal before player shot it.
  //Player's heart will decrease by one.
  //Like resetedState, it will also check whether the game has ended and do the same thing
  function loseHeart (s:State){
    const index = s.goalCounter1
    const end = s.goalCounter1-1<=0
    if (end){
      s.enemy.forEach((e)=>svg.removeChild(document.getElementById(String(e.id))))
      s.bullet.forEach((e)=>svg.removeChild(document.getElementById(String(e.id))))
      const state = emptyState
      return {...state,text:"YOU LOSE"}
    }
    return {...s,
      goalCounter1: s.goalCounter1-1,
      zHeart: s.zHeart.slice(0,index-1).concat([-1],s.zHeart.slice(index,14)),
      topHeart: s.topHeart.slice(0,index-1).concat([110],s.topHeart.slice(index,14)),
    }
  }

  //This function will remove all the expired objects from the canvas and return a updated state
  const checkEnemy = function(s:State) {
    const arr = s.enemy.filter((x)=>x.expired==true)
    if (arr.length==0){return s} //If the state's enemy is empty, return the initial state directly
    else{
      arr.forEach(element => {
        const g = document.getElementById(String(element.id))
        svg.removeChild(g)
      });
      //If the enemy is expired but it reached the goal, call loseHeart function to reduce player's heart
      if (s.enemy.filter((x)=>x.expired==true&&x.x<=10).length>0){
        return loseHeart({...s,enemy:s.enemy.filter((x)=>x.expired==false)})
      }
      else{
        return {...s,enemy:s.enemy.filter((x)=>x.expired==false)}
      }
    }
  }

  //Function to move the bullet to the right
  const moveBullet = function (bullets: Array<Body>){
    return bullets.map((b)=>
      b.x>900?{...b,expired:true}:{...b,x:(b.x+5)}
    )
  }

  //Function to move the enemy to the left
  const moveEnemy = function (enems: Array<Body>){
    return enems.map((e)=>
      e.x<10?{...e,expired:true}:{...e,x:(e.x-1.5)}) 
  }

  //This function will check whether the bullet shot any enemy, and return updated state by changing collided objects' expired true
  const shootingAction = function (s:State){
    return {...s,
    bullet:s.bullet.map(b =>s.enemy.filter(e =>(Math.abs(e.x-b.x)<=15 && (e.y<=b.y&&e.y+40>=b.y))).length>0?{...b,expired:true}:b),
    enemy:s.enemy.map(e =>s.bullet.filter(b =>(Math.abs(e.x-b.x)<=15 && (e.y<=b.y&&e.y+40>=b.y))).length>0?{...e,expired:true}:e)
    }
  }

  //Initial state for each game
  const initialState: State = {    
    xPad1: 10,
    yPad1: 250,
    xPad2: 885,
    yPad2: 250,
    xBall: 500,
    yBall: 250,
    degree: (((Math.floor(0.5 * Math.floor(3))+1)*2)+1)*45,
    goalCounter1: 7,
    goalCounter2: 7,
    zHeart:[1,1,1,1,1,1,1,1,1,1,1,1,1,1], //hearts are displayed
    topHeart:[75,75,75,75,75,75,75,75,75,75,75,75,75,75],
    retryMsg: "",
    fillBox: "#461a8d00",
    text:"",
    bullet:[],
    enemy:[],
    random:0,
  };

  //State where the game is waiting for the player to press enter to restart the game
  const emptyState: State = {    
    xPad1: 0,
    yPad1: 0,
    xPad2: 0,
    yPad2: 0,
    xBall: 500,
    yBall: 250,
    degree: (((Math.floor(0.5 * Math.floor(3))+1)*2)+1)*45,
    goalCounter1: 7,
    goalCounter2: 7,
    zHeart:[1,1,1,1,1,1,1,1,1,1,1,1,1,1], //hearts are not displayed
    topHeart:[75,75,75,75,75,75,75,75,75,75,75,75,75,75],
    retryMsg:"Press enter to retry",
    fillBox: "#461a8d",
    text:"",
    bullet:[],
    enemy:[],
    random:0,
  };
  
  //Function that will update all elements according to the given state in the parameter
  function updateView(state:State): void {
    //Get the element from the html file
    const paddle1 = document.getElementById("paddle1")!;
    const paddle2 = document.getElementById("paddle2")!;
    const ball = document.getElementById("ball")!;
    const box = document.getElementById("resultBox")!;
    const text = document.getElementById("resultText")!;
    const retryMsg = document.getElementById("retryMsg")!;
    const hearts = [<HTMLElement><any>document.querySelector(".heart1"),<HTMLElement><any>document.querySelector(".heart2"),
                    <HTMLElement><any>document.querySelector(".heart3"),<HTMLElement><any>document.querySelector(".heart4"),
                    <HTMLElement><any>document.querySelector(".heart5"),<HTMLElement><any>document.querySelector(".heart6"),
                    <HTMLElement><any>document.querySelector(".heart7"),<HTMLElement><any>document.querySelector(".heart8"),
                    <HTMLElement><any>document.querySelector(".heart9"),<HTMLElement><any>document.querySelector(".heart10"),
                    <HTMLElement><any>document.querySelector(".heart11"),<HTMLElement><any>document.querySelector(".heart12"),
                    <HTMLElement><any>document.querySelector(".heart13"),<HTMLElement><any>document.querySelector(".heart14")]
    //Set all attributes to the corresponding elements
    paddle1.setAttribute('transform',`translate(${state.xPad1},${state.yPad1})`)
    paddle2.setAttribute('transform',`translate(${state.xPad2},${state.yPad2})`)
    ball.setAttribute('transform',`translate(${state.xBall},${state.yBall})`)
    const index = range(0,14)
    index.forEach(i => {
      hearts[i].style.zIndex=String(state.zHeart[i]);
      hearts[i].style.top=String(state.topHeart[i]);
    });
    retryMsg.innerHTML=String(state.retryMsg)
    box.style.fill=String(state.fillBox)
    text.innerHTML=String(state.text)

    if (state.enemy.length>0){
      state.enemy.forEach(e=>{
        const createEnemy = function (){
          const v = document.createElementNS(svg.namespaceURI, "image")!;
          v.setAttribute("id",String(e.id));
          v.setAttribute("href","enemy1.gif")
          v.setAttribute("x","880")
          v.setAttribute("y",String(Math.floor(Math.abs(state.random) * Math.floor(360))+10))
          v.setAttribute("width","40")
          v.setAttribute("height","40")
          svg.appendChild(v)
          return v
        }
        //If enemy does not exist on the html file, create one and append it to the html before setting its attributes
        const v = document.getElementById(String(e.id)) || createEnemy()
        v.setAttribute("x",String(e.x))
        v.setAttribute("y",String(e.y))
      })
    }

    if (state.bullet.length>0){
      state.bullet.forEach(b=>{
        const createBulletView = ()=>{
          const v = document.createElementNS(svg.namespaceURI, "rect")!;
          v.setAttribute("id",String(b.id));
          v.setAttribute("width","20")
          v.setAttribute("height","2")
          v.setAttribute("fill","white")
          v.classList.add("bullet")
          svg.appendChild(v)
          return v;
        }
        //If bullet does not exist on the html file, create one and append it to the html before setting its attributes
        const v = document.getElementById(String(b.id)) || createBulletView();
        v.setAttribute("x",String(b.x))
        v.setAttribute("y",String(b.y))
      })
    }
  }

  const reduceState = (s:State, e:ballMove|pad1Move|pad2Move|Shoot|Tick|spawner|enemyFilter|hit|enter|doNothing|RNG)=>
    e instanceof pad1Move ? {...s,yPad1:e.y} : //move player's paddle
    e instanceof pad2Move ? {...s,yPad2:s.xBall>600?s.yPad2>s.yBall?s.yPad2-2:s.yPad2+2:s.yPad2} : //move computer's paddle
    e instanceof ballMove ? calculateBallPosition(s): //move ball's paddle
    e instanceof Shoot ? {...s,
      bullet: s.bullet.concat([{id:"bullet"+String(s.bullet.length),x:s.xPad1,y:s.yPad1+30,expired:false}])} : //shoot a bullet
    e instanceof Tick ? {...s,
      bullet: moveBullet(s.bullet), enemy: moveEnemy(s.enemy) }: //move enemies and bullets
    e instanceof spawner? {...s,
      enemy: s.enemy.concat([{id:"enemy"+String(Math.abs(s.random)),x:s.xPad2,y:Math.floor(Math.abs(s.random) * Math.floor(370))+20,expired:false}])}: //spawn enemy the game
    e instanceof enemyFilter ? checkEnemy(s): //remove all expired objects from the canvas and state
    e instanceof hit? shootingAction(s): //shooting action, make object expired if they collide
    e instanceof enter? s.retryMsg.length>0?initialState:s: //restart the game if enter is pressed
    e instanceof RNG? {...s,random:e.nextFloat()}: //replace state random number to a new one
    e instanceof doNothing? s //return initial state
    :null

  //Observer to change the seed of random number every 1ms
  const randomness = interval(1)
  .pipe(map((x)=>new RNG(x)))
  //Observer of mouse movement to move player's paddle
  const paddle1Movement = fromEvent<MouseEvent>(document, "mousemove")
  .pipe(map(({ clientX, clientY }) => clientY>=10 && clientY<=420?(new pad1Move(clientY)):clientY<=10?(new pad1Move(10)):(new pad1Move(420))))
  //Observer of computer's paddle movement
  const paddle2Movement = interval(10)
  .pipe(map(()=>new pad2Move()))
  //Observer of ball's movement
  const ballMovement = interval(1)
  .pipe(map(()=>new ballMove()))
  //Observer of space key, if it is pressed then shoot
  const shootAction = fromEvent<KeyboardEvent>(document,"keydown")
  .pipe(map((key)=>key.keyCode==32?new Shoot():new doNothing()))
  //Observer to spawn enemy in 4s interval
  const spawnEnemy1 = interval(4000)
  .pipe(map(()=>new spawner))
  //Observer to spawn enemy in 6.5s interval
  const spawnEnemy2 = interval(6500)
  .pipe(map(()=>new spawner))
  //Observer to spawn enemy in 3.5s interval
  const spawnEnemy3 = interval(3500)
  .pipe(map(()=>new spawner))
  //Observer to remove any expired objects
  const enemyObsv = interval(1)
  .pipe(map(()=>new enemyFilter))
  //Observer to check whether bullet and enemy have collided
  const bulletObsv = interval(1)
  .pipe(map(()=>new hit()))
  //Observer to move objects (enemy and bullet)
  const tick = interval(5)
  .pipe(map(()=>new Tick()))
  //Observer of space key, if it is press then restart game
  const restarted = fromEvent<KeyboardEvent>(document,"keydown")
  .pipe(map((key)=>key.keyCode==13?new enter():new doNothing))

  const merged = paddle1Movement.pipe(merge(ballMovement,paddle2Movement,shootAction,tick,spawnEnemy1,enemyObsv,bulletObsv,spawnEnemy2,spawnEnemy3,restarted,randomness))
  .pipe(scan(reduceState,initialState))
  .subscribe(updateView)
}
  
  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
    window.onload = ()=>{
      pong();
    }