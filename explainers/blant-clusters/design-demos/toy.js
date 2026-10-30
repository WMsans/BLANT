// Shared toy graph for the direction drafts: two communities + a bridge.
// Keyframe state: S={0..4} (9 edges, 1-3 missing), candidate u=5 brings 3 edges -> 12/15 = 0.80.
window.TOY = {
  nodes: [
    [150,120],[260,80],[300,190],[180,250],[90,210],[230,320],[330,300],[430,260],
    [520,190],[620,130],[600,250],[700,220],[690,340],[470,370]
  ],
  edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,4],[2,3],[2,4],[3,4],[5,0],[5,2],[5,4],
          [6,3],[6,5],[6,7],[7,8],[8,9],[8,10],[8,11],[9,10],[9,11],[10,11],[10,12],[11,12],[9,12],[13,12],[13,4]],
  S: [0,1,2,3,4], cand: 5,
  svg(o){ // o: {w,h,edge,edgeS,edgeNew,node,nodeS,nodeC,stroke,r,label,scale,dx,dy}
    const s=o.scale||1, dx=o.dx||0, dy=o.dy||0, P=this.nodes.map(([x,y])=>[x*s+dx,y*s+dy]);
    const inS=i=>this.S.includes(i), c=this.cand;
    let out='';
    for(const [a,b] of this.edges){
      const sS=inS(a)&&inS(b), nw=(a===c&&inS(b))||(b===c&&inS(a));
      const col=nw?o.edgeNew:sS?o.edgeS:o.edge, w=nw?(o.wNew||3.5):sS?(o.wS||2.5):(o.w||1.4);
      out+=`<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${nw&&o.dash?` stroke-dasharray="${o.dash}"`:''}/>`;
    }
    P.forEach(([x,y],i)=>{
      const f=i===c?o.nodeC:inS(i)?o.nodeS:o.node, r=(o.r||14)*(i===c?1.15:1);
      if(i===c&&o.halo) out+=`<circle cx="${x}" cy="${y}" r="${r*2}" fill="none" stroke="${o.nodeC}" stroke-opacity=".35" stroke-width="2"/>`;
      out+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${o.stroke||'none'}" stroke-width="${o.sw||2}"/>`;
      if(o.label) out+=`<text x="${x}" y="${y+4.5}" text-anchor="middle" font-size="${o.fs||13}" font-family="${o.ff||'monospace'}" fill="${o.label(i)}">${i}</text>`;
    });
    return out;
  }
};
