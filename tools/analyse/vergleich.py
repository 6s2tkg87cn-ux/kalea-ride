# Vergleicht echtes Tempo mit der App-Physik („Realistisch“: Crr 0,005, CdA 0,32, +2 kg, Luftdichte aus der Fahrt)
# bei gleicher Leistung und Steigung. Werte > 1: in der Fahrt schneller als die App.
# Aufruf: python3 tools/analyse/vergleich.py fahrt_a.npz fahrt_b.npz …
import numpy as np,sys,math
files=sys.argv[1:]
def app_v(P,g,M,rho=1.2,cda=0.32,crr=0.005,hub=1.2):
  th=math.atan(g);lo,hi=0.1,30
  for _ in range(60):
    v=(lo+hi)/2;F=M*9.81*(math.sin(th)+crr*math.cos(th))+0.5*rho*cda*v*v+hub
    if F*v>P:hi=v
    else:lo=v
  return (lo+hi)/2
print('Vergleich: tatsächliches Tempo / App-Vorhersage bei gleicher Leistung und Steigung (nur gleichmäßiges Treten)')
print('%-10s'%'Datei'+''.join('%11s'%s for s in ['-6..-3%','-3..-1%','±1%','+1..3%','+3..5%','+5..7%','+7..9%','+9..14%']))
bins=[(-0.06,-0.03),(-0.03,-0.01),(-0.01,0.01),(0.01,0.03),(0.03,0.05),(0.05,0.07),(0.07,0.09),(0.09,0.14)]
for f in files:
  z=np.load(f);v,p,c,g,acc,t=z['v'],z['p'],z['c'],z['g'],z['acc'],z['t'];dt=np.gradient(t)
  M=81 # 70 kg + 9 kg Rad
  ok=(v>2)&(np.abs(acc)<0.06)&(~np.isnan(g))&(p>60)&(c>50)&(dt<1.5)
  row='%-10s'%f.split('.')[0]
  for lo,hi in bins:
    m=ok&(g>=lo)&(g<hi)
    if m.sum()<30:row+='%11s'%'–';continue
    idx=np.where(m)[0][::3]
    r=[v[i]/app_v(p[i],g[i],M,rho=float(z["rho"][i]) if z["rho"].ndim else float(z["rho"])) for i in idx]
    row+='%7.2f(%3d)'%(np.median(r),len(idx))
  print(row)
