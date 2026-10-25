const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),element=()=>({innerHTML:'',textContent:'',events:{},setAttribute(){},append(){},focus(){this.focused=true},showModal(){this.open=true},close(){this.open=false},addEventListener(name,fn){this.events[name]=fn}});
const query=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)};
const item=(id,name,lat)=>({id,name,feature:{geometry:{coordinates:[[[-73.12,lat],[-73.121,lat+.001]]]}}});
const buildings=[item('1','Melville Library',40.91),item('2','Island Federal Credit Union Arena',40.92),item('3','Stony Brook Union',40.93),item('4','Charles B. Wang Center <test>',40.94)];
let selected=null,home=0,ready=true,fail=false;const origins=[],toasts=[];
class FormData extends Map{constructor(form){super(form.values)}}
const context={window:{studyCampus:{buildings:()=>ready?buildings:[],home(){home++},select:value=>selected=value},WalkRouting:{async load(){if(fail)throw Error('Paths unavailable')},paths(point){origins.push(point);return{}},routeTo(building){return{meters:building.id==='1'?1000:building.id==='3'?100:50}}}},document:{querySelector:query,createElement(){const result=element();Object.defineProperty(result,'id',{set:id=>elements.set('#'+id,result)});return result},body:{append(){}}},FormData,localStorage:{getItem(){throw Error('Retired personal records must not be read')},setItem(){throw Error('Planner must not store personal records')}},toast:message=>toasts.push(message)};
vm.runInNewContext(fs.readFileSync('public/student-tools.js','utf8'),context);
const launcher=query('#studentTools'),dialog=query('#studentDialog');
launcher.onclick();assert(dialog.open);assert(dialog.innerHTML.includes('Plan a study break'));assert(dialog.innerHTML.includes('breakPlanner'));assert(!dialog.innerHTML.includes('student-tabs'));
for(const text of ['Laundry','Meet up','Essentials','Events','Issues','weekly schedule','Food'])assert(!dialog.innerHTML.includes(text),'Removed dashboard feature: '+text);
const submit=(minutes='45',origin='1',destination='3')=>query('#breakPlanner').onsubmit({preventDefault(){},target:{values:[['minutes',minutes],['origin',origin],['destination',destination]]}});
(async()=>{
 await submit();let result=query('#breakResults').innerHTML;
 assert(result.includes('Stony Brook Union'));assert(result.includes('&lt;test&gt;'));assert(!result.includes('Credit Union Arena'));assert(!result.includes('<h3>Melville Library'));
 assert(result.indexOf('Wang')<result.indexOf('Union'),'Options with more study time should appear first');assert.equal(origins.length,2);assert.notDeepEqual(origins[0],origins[1]);
 await submit('20');assert(query('#breakResults').innerHTML.includes('No option fits'));
 await submit('NaN');assert(query('#breakResults').textContent.includes('between 20 and 240'));
 await submit('45','missing');assert(query('#breakResults').textContent.includes('starting building'));
 fail=true;await submit();assert.equal(query('#breakResults').textContent,'Paths unavailable');
 dialog.events.click({target:{closest:()=>({dataset:{map:'3'}})}});assert.equal(selected.id,'3');assert.equal(home,1);assert.equal(dialog.open,false);
 ready=false;launcher.onclick();assert.equal(dialog.open,false);assert(toasts.at(-1).includes('still loading'));
 console.log('PASS: focused planner, removed dashboard tools, route budget/buffer, valid study destinations, escaped output, errors and map selection');
})().catch(error=>{console.error(error);process.exitCode=1});
