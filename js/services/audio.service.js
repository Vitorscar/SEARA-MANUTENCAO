export function alertaCritico(){
  document.body.classList.add('critical-flash');
  setTimeout(() => document.body.classList.remove('critical-flash'), 2000);
  if(navigator.vibrate) navigator.vibrate([200,100,200,100,250]);

  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 260, 520].forEach(delay => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 0.16);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.18);
      }, delay);
    });
  }catch(e){}
}