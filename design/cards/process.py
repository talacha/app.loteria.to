import sys,json,os,subprocess,urllib.request
from PIL import Image
R='/Users/robcr/Projects/app.loteria.to/'
CAP=70
def cr(px):
    r,g,b=px
    return (min(r,g,b)>210 and max(r,g,b)-min(r,g,b)<55) or (r>222 and g>203 and b>165 and r>=b+10)
def depth(im,edge):
    w,h=im.size;px=im.load();d=0
    for k in range(CAP):
        if edge in 'tb':
            y=k if edge=='t' else h-1-k
            n=sum(cr(px[x,y]) for x in range(0,w,3))/len(range(0,w,3))
        else:
            x=k if edge=='l' else w-1-k
            n=sum(cr(px[x,y]) for y in range(0,h,3))/len(range(0,h,3))
        if n>=0.5: d+=1
        else: break
    return d
def convert(png,out,q=82):
    im=Image.open(png).convert('RGB');w,h=im.size
    dt,db,dl,dr=[depth(im,e) for e in 'tblr']
    ds=[dt,db,dl,dr];ds=[0 if (d>=CAP or d<6) else d+8 for d in ds]
    t,b,l,r=ds
    im=im.crop((l,t,w-r,h-b))
    W,H=im.size;s=max(600/W,900/H);nw,nh=round(W*s),round(H*s)
    im=im.resize((nw,nh),Image.LANCZOS)
    x=(nw-600)//2;y=(nh-900)//2
    im=im.crop((x,y,x+600,y+900))
    tmp=out+'.png';im.save(tmp)
    subprocess.run(['cwebp','-q',str(q),'-quiet',tmp,'-o',out],check=True);os.remove(tmp)
    return ds
if __name__=='__main__':
    cid,url=sys.argv[1],sys.argv[2];node=sys.argv[3] if len(sys.argv)>3 else ''
    raw=R+f'design/cards/raw/{cid}.png'
    subprocess.run(["curl","-sfL","-o",raw,url],check=True)
    out=R+f'public/cards/{cid}.webp'
    ds=convert(raw,out)
    pj=R+'design/cards/progress.json'
    p=json.load(open(pj)) if os.path.exists(pj) else {}
    old=p.get(cid,{})
    p[cid]={'status':'done','nodeId':node,'bytes':os.path.getsize(out),'regen':old.get('regen',0)+(1 if old else 0)}
    json.dump(p,open(pj,'w'),indent=1)
    print(cid,ds,p[cid]['bytes'])
