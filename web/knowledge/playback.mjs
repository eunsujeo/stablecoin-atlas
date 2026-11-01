import {presentationTime,modelTime,playbackDuration} from './pacing.mjs';
import {clamp,stepTime} from './engine.mjs';
export function playback(state,action){
 switch(action.type){
  case 'play':return {...state,t:state.t>=24?0:state.t,playing:!state.reduced};
  case 'pause':return {...state,playing:false};
  case 'seek':if(!Number.isFinite(action.time))throw Error('INVALID_TIME');return {...state,t:clamp(action.time,0,24),playing:false};
  case 'step':return {...state,t:stepTime(state.t,action.direction),playing:false};
  case 'speed':if(![.5,1,1.5,2].includes(action.speed))throw Error('INVALID_SPEED');return {...state,speed:action.speed};
  case 'reduce':return {...state,reduced:!!action.value,playing:false};
  case 'tick':if(!Number.isFinite(action.delta)||action.delta<0)throw Error('INVALID_DELTA');if(!state.playing)return state;const t=modelTime(Math.min(playbackDuration(state.pacing),presentationTime(state.t,state.pacing)+action.delta*state.speed),state.pacing);return {...state,t,playing:t<24};
  default:throw Error('UNKNOWN_ACTION');
 }
}
