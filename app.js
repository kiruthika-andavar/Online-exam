const api = (path, opts={}) =>
  fetch(path, {
    ...opts,
    headers: {
      'Content-Type':'application/json',
      ...(localStorage.token ? {Authorization:'Bearer '+localStorage.token} : {})
    }
  }).then(r=>r.json());

async function signup(){
  const email=semail.value, name=sname.value, password=spass.value;
  const r = await api('/api/signup',{method:'POST',body:JSON.stringify({email,name,password})});
  if(r.token){ localStorage.token=r.token; alert('Signed up!'); me(); } else alert(r.error||'error');
}
async function login(){
  const r = await api('/api/login',{method:'POST',body:JSON.stringify({email:lemail.value,password:lpass.value})});
  if(r.token){ localStorage.token=r.token; alert('Logged in!'); me(); } else alert(r.error||'error');
}
async function me(){
  const r = await api('/api/me');
  const el = document.getElementById('me'); if(!el) return;
  el.textContent = r ? `${r.name} (${r.email})` : 'Not logged in';
}
async function updateName(){
  await api('/api/me',{method:'POST',body:JSON.stringify({name:newname.value})});
  me();
}
async function changePass(){
  await api('/api/me/password',{method:'POST',body:JSON.stringify({oldPassword:oldp.value,newPassword:newp.value})});
  alert('Password updated');
}
function logout(){ localStorage.removeItem('token'); alert('Logged out'); }

let attemptId, remaining=0, tick;
async function goExam(){ location.href='exam.html'; }

async function startExamPage(){
  if(!localStorage.token){ alert('Login first'); location.href='index.html'; return; }
  const exams = await api('/api/exams');
  const ex = exams[0];
  const start = await api(`/api/exams/${ex.id}/start`,{method:'POST'});
  attemptId = start.attemptId; remaining = start.durationSec;
  renderQuestions(start.questions);
  startTimer();
}

function renderQuestions(qs){
  const c = document.getElementById('qs');
  c.innerHTML = '';
  qs.forEach(q=>{
    const div = document.createElement('div');
    div.innerHTML = `
      <p><b>${q.id}.</b> ${q.text}</p>
      ${['A','B','C','D'].map(k => `
        <label><input type="radio" name="q${q.id}" value="${k}"> ${q['opt_'+k.toLowerCase()]}</label><br>
      `).join('')}
      <hr/>`;
    div.onchange = async (e)=>{
      const ans = e.target.value;
      await api(`/api/attempts/${attemptId}/answer`, {
        method:'POST', body:JSON.stringify({questionId:q.id, answer:ans})
      });
    };
    c.appendChild(div);
  });
}

function startTimer(){
  const t = document.getElementById('timer');
  tick = setInterval(()=>{
    if(remaining<=0){ clearInterval(tick); submitExam(true); return; }
    remaining--;
    const m = String(Math.floor(remaining/60)).padStart(2,'0');
    const s = String(remaining%60).padStart(2,'0');
    t.textContent = `${m}:${s}`;
  },1000);
}

async function submitExam(auto=false){
  const res = await api(`/api/attempts/${attemptId}/submit`, {method:'POST'});
  document.getElementById('result').textContent =
    `Submitted ${auto?'(auto)':''}. Your score: ${res.score}`;
}