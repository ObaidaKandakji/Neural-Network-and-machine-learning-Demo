const carCanvas=document.getElementById("carCanvas");
carCanvas.width=200;

const networkCanvas=document.getElementById("networkCanvas");
networkCanvas.width=300;

const generationValue=document.getElementById("generationValue");
const activeCarsValue=document.getElementById("activeCarsValue");
const bestFitnessValue=document.getElementById("bestFitnessValue");
const bestPassesValue=document.getElementById("bestPassesValue");
const bestEverScoreValue=document.getElementById("bestEverScoreValue");

const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");

const road= new Road(carCanvas.width/2,carCanvas.width*0.9);

const STORAGE_KEY="bestBrain:v2";
const LEGACY_STORAGE_KEY="bestBrain";
const CAR_COUNT=100;
const MAX_GENERATION_FRAMES=1800;
const MUTATION_RATE=0.12;
const PARENT_POOL_SIZE=5;
const AI_START_Y=100;
const PASS_SCORE_VALUE=10000;
const DISTANCE_TIEBREAKER_SCALE=0.01;
const TRAFFIC_TEMPLATE=[
    {lane:1,y:-100},
    {lane:0,y:-300},
    {lane:2,y:-300},
    {lane:0,y:-500},
    {lane:1,y:-500},
    {lane:1,y:-700},
    {lane:2,y:-700}
];

let cars=[];
let traffic=[];
let bestCar=null;
let generationNumber=0;
let generationFrame=0;
let bestEverBrain=null;
let bestEverScore=Number.NEGATIVE_INFINITY;

const savedBrain=loadSavedBrain();
if(savedBrain){
    bestEverBrain=cloneBrain(savedBrain);
}

if(localStorage.getItem(LEGACY_STORAGE_KEY) && !localStorage.getItem(STORAGE_KEY)){
    console.info("Ignoring legacy bestBrain save because the v2 network shape changed.");
}

startGeneration(savedBrain?[savedBrain]:[]);
animate();

function save(){
    if(!bestEverBrain){
        return;
    }
    localStorage.setItem(STORAGE_KEY,JSON.stringify(bestEverBrain));
}

function discard(){
    localStorage.removeItem(STORAGE_KEY);
    bestEverBrain=null;
    bestEverScore=Number.NEGATIVE_INFINITY;
    startGeneration([]);
}

function loadSavedBrain(){
    const rawBrain=localStorage.getItem(STORAGE_KEY);
    if(!rawBrain || rawBrain==="undefined"){
        return null;
    }

    try{
        const parsedBrain=JSON.parse(rawBrain);
        return isCompatibleBrain(parsedBrain)?parsedBrain:null;
    }catch(error){
        console.warn("Unable to load the saved brain.",error);
        return null;
    }
}

function isCompatibleBrain(brain){
    return Boolean(
        brain &&
        Array.isArray(brain.levels) &&
        brain.levels.length===2 &&
        Array.isArray(brain.levels[0]?.weights) &&
        brain.levels[0].weights.length===7 &&
        Array.isArray(brain.levels[0].weights[0]) &&
        brain.levels[0].weights[0].length===8 &&
        Array.isArray(brain.levels[0]?.biases) &&
        brain.levels[0].biases.length===8 &&
        Array.isArray(brain.levels[1]?.weights) &&
        brain.levels[1].weights.length===8 &&
        Array.isArray(brain.levels[1].weights[0]) &&
        brain.levels[1].weights[0].length===4 &&
        Array.isArray(brain.levels[1]?.biases) &&
        brain.levels[1].biases.length===4
    );
}

function cloneBrain(brain){
    return JSON.parse(JSON.stringify(brain));
}

function generateTraffic(){
    return TRAFFIC_TEMPLATE.map((config,index)=>{
        const trafficCar=new Car(
            road.getLaneCenter(config.lane),
            config.y,
            30,
            50,
            "DUMMY",
            2
        );
        trafficCar.id=index;
        return trafficCar;
    });
}

function generateCars(count){
    const generatedCars=[];
    for(let i=0;i<count;i++){
        generatedCars.push(new Car(road.getLaneCenter(1),AI_START_Y,30,50,"AI"));
    }
    return generatedCars;
}

function seedCars(parentBrains){
    if(!parentBrains.length){
        return;
    }

    cars[0].brain=cloneBrain(parentBrains[0]);
    for(let i=1;i<cars.length;i++){
        const parentBrain=selectWeightedParent(parentBrains);
        cars[i].brain=cloneBrain(parentBrain);
        NeuralNetwork.mutate(cars[i].brain,MUTATION_RATE);
    }
}

function selectWeightedParent(parentBrains){
    const totalWeight=parentBrains.reduce((sum,_,index)=>sum+(parentBrains.length-index),0);
    let threshold=Math.random()*totalWeight;

    for(let i=0;i<parentBrains.length;i++){
        threshold-=parentBrains.length-i;
        if(threshold<=0){
            return parentBrains[i];
        }
    }

    return parentBrains[0];
}

function startGeneration(parentBrains){
    generationNumber++;
    generationFrame=0;
    traffic=generateTraffic();
    cars=generateCars(CAR_COUNT);
    seedCars(parentBrains);
    scoreCars();
    bestCar=pickLeader(cars);
    updateStatus();
}

function scoreCar(car){
    car.distanceScore=car.startY-car.y;
    car.collisionPenalty=car.damaged?1500:0;
    car.stallPenalty=car.stalled?750:0;
    const passScore=car.passedTrafficCount*PASS_SCORE_VALUE;
    const progressTiebreaker=Math.max(car.distanceScore,0)*DISTANCE_TIEBREAKER_SCALE;
    car.fitness=passScore+progressTiebreaker-car.collisionPenalty-car.stallPenalty;
}

function scoreCars(){
    for(let i=0;i<cars.length;i++){
        scoreCar(cars[i]);
    }
}

function pickHighestFitness(candidates){
    if(!candidates.length){
        return null;
    }

    return candidates.reduce((bestCandidate,currentCandidate)=>
        currentCandidate.fitness>bestCandidate.fitness
            ?currentCandidate
            :bestCandidate
    );
}

function pickLeader(candidates){
    const activeCandidates=candidates.filter(car=>car.active);
    return pickHighestFitness(activeCandidates.length?activeCandidates:candidates);
}

function breedNextGeneration(candidates){
    const rankedCars=[...candidates].sort((carA,carB)=>carB.fitness-carA.fitness);
    const bestGenerationCar=rankedCars[0];

    if(bestGenerationCar && (!bestEverBrain || bestGenerationCar.fitness>bestEverScore)){
        bestEverScore=bestGenerationCar.fitness;
        bestEverBrain=cloneBrain(bestGenerationCar.brain);
    }

    return rankedCars
        .slice(0,PARENT_POOL_SIZE)
        .map(car=>cloneBrain(car.brain));
}

function formatScore(value){
    return Number.isFinite(value)?Math.round(value).toString():"N/A";
}

function updateStatus(){
    const activeCars=cars.filter(car=>car.active).length;
    const generationBestCar=pickHighestFitness(cars);

    generationValue.textContent=generationNumber;
    activeCarsValue.textContent=activeCars;
    bestFitnessValue.textContent=generationBestCar?formatScore(generationBestCar.fitness):"0";
    bestPassesValue.textContent=generationBestCar?generationBestCar.passedTrafficCount:"0";
    bestEverScoreValue.textContent=formatScore(bestEverScore);
}

function drawScene(time){
    if(!bestCar){
        return;
    }

    carCanvas.height=window.innerHeight;
    networkCanvas.height=window.innerHeight;

    carCtx.save();
    carCtx.translate(0,-bestCar.y+carCanvas.height*0.7);

    road.draw(carCtx);
    for(let i=0;i<traffic.length;i++){
        traffic[i].draw(carCtx,"red");
    }

    carCtx.globalAlpha=0.2;
    for(let i=0;i<cars.length;i++){
        cars[i].draw(carCtx,"blue");
    }
    carCtx.globalAlpha=1;
    bestCar.draw(carCtx,"blue",true);
    carCtx.restore();

    networkCtx.lineDashOffset=-time/50;
    Visualizer.drawNetwork(networkCtx,bestCar.brain);
}

function animate(time){
    generationFrame++;

    for(let i=0;i<traffic.length;i++){
        traffic[i].update(road.borders,[]);
    }

    for(let i=0;i<cars.length;i++){
        if(cars[i].active){
            cars[i].update(road.borders,traffic);
        }
    }

    scoreCars();

    if(generationFrame>=MAX_GENERATION_FRAMES || cars.every(car=>!car.active)){
        const parentBrains=breedNextGeneration(cars);
        startGeneration(parentBrains);
    }

    bestCar=pickLeader(cars);
    updateStatus();
    drawScene(time);
    requestAnimationFrame(animate);
}
