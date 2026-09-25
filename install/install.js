(()=>{
  const BACKEND_URL="https://done-push-api.wanderwerkhoven.workers.dev";
  const PENDING_TRANSFER_KEY="done-pending-transfer-v1";
  const token=new URL(window.location.href).searchParams.get("transfer")||"";
  const iconMatch=window.location.pathname.match(/\/(illustration|simple)-(0[1-9]|1[0-6])\.html$/);
  if(!iconMatch||!/^[A-Za-z0-9_-]{32,128}$/.test(token))return;

  const icon=`${iconMatch[1]}-${iconMatch[2]}`;
  try{localStorage.setItem(PENDING_TRANSFER_KEY,token)}catch{}

  const root=new URL("../",window.location.href);
  const manifestUrl=new URL(`${BACKEND_URL}/install-manifest`);
  manifestUrl.searchParams.set("icon",icon);
  manifestUrl.searchParams.set("transfer",token);
  manifestUrl.searchParams.set("root",root.href);

  const link=document.querySelector('link[rel="manifest"]');
  if(link){
    link.crossOrigin="anonymous";
    link.href=manifestUrl.href;
  }
})();