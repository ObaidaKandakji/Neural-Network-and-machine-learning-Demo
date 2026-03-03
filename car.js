const STUCK_FRAME_LIMIT=120;
const CLOSE_OBSTACLE_THRESHOLD=0.35;
const STALL_SPEED_THRESHOLD=2.15;
const RECENT_PASS_WINDOW=30;
const FORWARD_SENSOR_WINDOW=1;

class Car{
    constructor(x,y,width,height,controlType,maxSpeed=3){
        this.x=x;
        this.y=y;
        this.width=width;
        this.height=height;

        this.speed=0;
        this.acceleration=0.2;
        this.maxSpeed=maxSpeed;
        this.friction=0.05;
        this.angle=0;
        this.damaged=false;
        this.active=true;
        this.stalled=false;
        this.fitness=0;
        this.distanceScore=0;
        this.collisionPenalty=0;
        this.stallPenalty=0;
        this.passedTrafficCount=0;
        this.passedTrafficIds=new Set();
        this.stuckFrames=0;
        this.framesSincePass=0;
        this.startY=y;

        this.useBrain=controlType=="AI";

        if(controlType!="DUMMY"){
            this.sensor=new Sensor(this);
            this.brain=new NeuralNetwork(
                [this.sensor.rayCount,8,4]
            );
        }
        this.controls = new Controls(controlType);
        this.polygon=this.#createPolygon();
    }

    update(roadBorders,traffic){
        if(!this.active){
            return;
        }

        if(!this.damaged){
            this.#move();
            this.polygon=this.#createPolygon();
            this.damaged=this.#assessDamage(roadBorders,traffic);
        }

        if(this.damaged){
            this.active=false;
            return;
        }

        if(this.sensor){
            this.sensor.update(roadBorders,traffic);
            const offsets=this.sensor.readings.map(
                s=>s==null?0:1-s.offset
            );
            const outputs=NeuralNetwork.feedForward(offsets,this.brain);

            if(this.useBrain){
                this.controls.forward=outputs[0];
                this.controls.left=outputs[1];
                this.controls.right=outputs[2];
                this.controls.reverse=outputs[3];
                this.#resolveControls();
            }

            const passedTrafficThisFrame=this.#updatePassedTraffic(traffic);
            if(passedTrafficThisFrame){
                this.framesSincePass=0;
                this.stuckFrames=0;
            }else{
                this.framesSincePass++;
                this.#updateStuckState();
            }
        }
    }

    #assessDamage(roadBorders,traffic){
        for(let i=0; i<roadBorders.length;i++){
            if(polysIntersect(this.polygon,roadBorders[i])){
                return true;
            }
        }
        for(let i=0; i<traffic.length;i++){
            if(polysIntersect(this.polygon,traffic[i].polygon)){
                return true;
            }
        }
        return false;
    }

    #createPolygon(){
        const points=[];
        const rad=Math.hypot(this.width,this.height)/2;
        const alpha=Math.atan2(this.width,this.height);
        points.push({
            x:this.x-Math.sin(this.angle-alpha)*rad,
            y:this.y-Math.cos(this.angle-alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(this.angle+alpha)*rad,
            y:this.y-Math.cos(this.angle+alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle-alpha)*rad,
            y:this.y-Math.cos(Math.PI+this.angle-alpha)*rad
        });
        points.push({
            x:this.x-Math.sin(Math.PI+this.angle+alpha)*rad,
            y:this.y-Math.cos(Math.PI+this.angle+alpha)*rad
        });
        return points;
    }

    #move(){
        if(this.controls.forward){
            this.speed+=this.acceleration;
        }
        if(this.controls.reverse){
            this.speed-=this.acceleration;
        }

        if(this.speed>this.maxSpeed){
            this.speed=this.maxSpeed;
        }

        if(this.speed<-this.maxSpeed/2){
            this.speed=-this.maxSpeed/2;
        }

        if(this.speed>0){
            this.speed-=this.friction;
        }

        if(this.speed<0){
            this.speed+=this.friction;
        }

        if(Math.abs(this.speed)<this.friction){
            this.speed=0;
        }

        if(this.speed!=0){
            const flip=this.speed>0?1:-1;
            if(this.controls.left){
                this.angle+=0.03*flip;
            }
            if(this.controls.right){
                this.angle-=0.03*flip;
            }
        }

        this.x-=Math.sin(this.angle)*this.speed;
        this.y-=Math.cos(this.angle)*this.speed;
    }

    #resolveControls(){
        if(this.controls.left && this.controls.right){
            this.controls.left=false;
            this.controls.right=false;
        }

        if(this.controls.forward && this.controls.reverse){
            this.controls.reverse=false;
        }
    }

    #updatePassedTraffic(traffic){
        let passedTraffic=false;

        for(let i=0;i<traffic.length;i++){
            if(this.passedTrafficIds.has(traffic[i].id)){
                continue;
            }

            if(this.y+this.height/2<traffic[i].y-traffic[i].height/2){
                this.passedTrafficIds.add(traffic[i].id);
                this.passedTrafficCount++;
                passedTraffic=true;
            }
        }

        return passedTraffic;
    }

    #updateStuckState(){
        const centerIndex=Math.floor(this.sensor.readings.length/2);
        const forwardReadings=this.sensor.readings.slice(
            Math.max(0,centerIndex-FORWARD_SENSOR_WINDOW),
            Math.min(this.sensor.readings.length,centerIndex+FORWARD_SENSOR_WINDOW+1)
        );
        const closeObstacle=
            forwardReadings.some(
                reading=>reading && reading.offset<CLOSE_OBSTACLE_THRESHOLD
            );
        const isBlocked=
            closeObstacle &&
            this.speed<STALL_SPEED_THRESHOLD &&
            this.framesSincePass>RECENT_PASS_WINDOW;

        if(!isBlocked){
            this.stuckFrames=0;
            return;
        }

        this.stuckFrames++;
        if(this.stuckFrames>STUCK_FRAME_LIMIT){
            this.stalled=true;
            this.active=false;
            this.speed=0;
        }
    }


    draw(ctx,color,drawSensor=false){
        if(this.damaged){
            ctx.fillStyle="gray";
        }else if(this.stalled){
            ctx.fillStyle="dimgray";
        }else{
            ctx.fillStyle=color;
        }
        if (this.polygon && this.polygon[0]) {
            ctx.beginPath();
            ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
            for(let i=1; i<this.polygon.length; i++){
                ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
            }
            ctx.fill();
        }
        if(this.sensor && drawSensor){
            this.sensor.draw(ctx);
        }
    }
    
}
