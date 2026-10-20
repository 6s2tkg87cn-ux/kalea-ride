# Physik aus einer Fahrt schätzen: Steigung (±60 m), Luftdichte nach Höhe/Temperatur, Crr und CdA per
# Ausgleichsrechnung, Tempo/Leistung/Kadenz je Steigungsklasse, Rolltempo bergab. Schreibt fahrt.npz.
# Aufruf: python3 tools/analyse/fitphys.py fahrt.json 79   (79 = Gesamtmasse Fahrer + Rad in kg; braucht numpy)
import json,sys,math
import numpy as np
f=sys.argv[1];R=json.load(open(f))
alt_k='enhanced_altitude'
t=[];d=[];v=[];p=[];c=[];h=[];T=[]
import datetime
for r in R:
  if 'distance' not in r or alt_k not in r:continue
  ts=datetime.datetime.fromisoformat(r['timestamp']).timestamp()
  t.append(ts);d.append(r['distance']);v.append(r.get('enhanced_speed',0) or 0);p.append(r.get('power',0) or 0);c.append(r.get('cadence',0) or 0);h.append(r[alt_k]);T.append(r.get('temperature',15) or 15)
t=np.array(t);d=np.array(d);v=np.array(v);p=np.array(p,float);c=np.array(c,float);h=np.array(h);T=np.array(T,float)
n=len(t);print(f,'Punkte',n,'Dauer %.0f min, %.1f km, Höhe %.0f–%.0f m'%((t[-1]-t[0])/60,d[-1]/1000,h.min(),h.max()))
# auf 1-s-Raster, nur zusammenhängende Abschnitte
# Steigung über ±60 m Distanz
def grade_at(i,win=60):
  lo=np.searchsorted(d,d[i]-win);hi=np.searchsorted(d,d[i]+win)-1
  if hi<=lo or d[hi]-d[lo]<win:return np.nan
  return (h[hi]-h[lo])/(d[hi]-d[lo])
g=np.array([grade_at(i) for i in range(n)])
# geglättete Werte (±5 s)
def sm(x,w=5):
  k=np.ones(2*w+1)/(2*w+1);return np.convolve(x,k,mode='same')
vs=sm(v);ps=sm(p);cs=sm(c)
acc=np.gradient(vs,t)
alt_mean=h.mean();rho_base=1.225*math.exp(-alt_mean/8500)*288/(273+T.mean())
print('Ø Luftdichte %.3f kg/m³ (Höhe %.0f m, %.0f °C)'%(rho_base,alt_mean,T.mean()))
M=float(sys.argv[2])  # Gesamtmasse
rho=1.225*np.exp(-h/8500)*288/(273+T)
# stationäre Stücke: Treten, wenig Beschleunigung, gültige Steigung, Tempo > 3 m/s, dt == 1
dt=np.gradient(t)
ok=(vs>3)&(np.abs(acc)<0.08)&(~np.isnan(g))&(ps>40)&(dt<1.5)&(cs>40)
# P = v*M*g*sin + v*M*g*Crr + 0.5*rho*CdA*v^3 + M*a*v    -> lineare Regression in Crr, CdA
th=np.arctan(np.nan_to_num(g))
y=ps[ok]-vs[ok]*M*9.81*np.sin(th[ok])-M*acc[ok]*vs[ok]
X=np.stack([vs[ok]*M*9.81*np.cos(th[ok]),0.5*rho[ok]*vs[ok]**3],1)
# Verlust im Antrieb ~2.5 %
y=y*0.975
sol,res,rk,sv=np.linalg.lstsq(X,y,rcond=None)
print('Stationäre Punkte',ok.sum(),'→ Crr %.4f  CdA %.3f m²'%(sol[0],sol[1]))
# robuster: in Steigungsklassen mitteln
print('Steigung | Punkte | Ø Tempo km/h | Ø Watt | Ø Trittfreq | Entfaltung m/U')
for lo,hi in [(-0.12,-0.06),(-0.06,-0.03),(-0.03,-0.01),(-0.01,0.01),(0.01,0.03),(0.03,0.05),(0.05,0.07),(0.07,0.09),(0.09,0.14)]:
  m=(g>=lo)&(g<hi)&(vs>1)&(dt<1.5)
  if m.sum()<20:continue
  ped=m&(cs>30)
  dev=np.median(vs[ped]/(cs[ped]/60)) if ped.sum()>10 else float('nan')
  print('%+5.0f..%+3.0f%% | %5d | %5.1f | %5.0f | %4.0f | %4.2f'%(lo*100,hi*100,m.sum(),vs[m].mean()*3.6,ps[m].mean(),cs[ped].mean() if ped.sum() else 0,dev))
# Rollen bergab ohne Treten: Endgeschwindigkeit
co=(ps<5)&(cs<5)&(vs>5)&(~np.isnan(g))&(g<-0.02)&(np.abs(acc)<0.1)
if co.sum()>20:
  print('Rollen ohne Treten (stationär):')
  for lo,hi in [(-0.04,-0.02),(-0.06,-0.04),(-0.08,-0.06),(-0.12,-0.08)]:
    m=co&(g>=lo)&(g<hi)
    if m.sum()>5:print('  %+.0f..%+.0f%%: %d s, Ø %.1f km/h'%(lo*100,hi*100,m.sum(),vs[m].mean()*3.6))
np.savez(f.replace('.json','.npz'),t=t,d=d,v=vs,p=ps,c=cs,h=h,g=g,acc=acc,rho=rho)
