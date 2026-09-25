(()=>{
  const PENDING_TRANSFER_KEY="done-pending-transfer-v1";
  const url=new URL(window.location.href);
  const token=url.searchParams.get("transfer")||"";
  const iconMatch=window.location.pathname.match(/\/(illustration|simple)-(0[1-9]|1[0-6])\.html$/);
  if(!iconMatch)return;

  const icon=`${iconMatch[1]}-${iconMatch[2]}`;
  const validToken=/^[A-Za-z0-9_-]{32,128}$/.test(token);

  if(validToken){
    try{localStorage.setItem(PENDING_TRANSFER_KEY,token)}catch{}
  }

  const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||
    window.navigator.standalone===true;

  // On iOS, adding the install page to the Home Screen launches the exact
  // page URL. That URL already contains the transfer token. On first launch,
  // forward it to DONE.'s root page so app.js can restore the state.
  if(standalone){
    const root=new URL("../",window.location.href);
    root.searchParams.set("appIcon",icon);
    if(validToken)root.searchParams.set("transfer",token);
    window.location.replace(root.href);
  }
})();