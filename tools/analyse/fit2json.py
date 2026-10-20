# FIT-Datei (Garmin/Zwift) → JSON mit allen record-Nachrichten.
# Aufruf: python3 tools/analyse/fit2json.py fahrt.fit fahrt.json   (braucht: pip install fitdecode)
import fitdecode,sys,json,collections
f=sys.argv[1];recs=[];msgs=collections.Counter();other={}
with fitdecode.FitReader(f) as fr:
  for fr_ in fr:
    if isinstance(fr_,fitdecode.FitDataMessage):
      msgs[fr_.name]+=1
      if fr_.name=='record':
        recs.append({fl.name:fl.value for fl in fr_.fields if fl.value is not None})
      elif fr_.name in ('session','device_info','event','sport','file_id','bike_profile','user_profile','zones_target','lap') and msgs[fr_.name]<=6:
        other.setdefault(fr_.name,[]).append({fl.name:(str(fl.value) if not isinstance(fl.value,(int,float,str,type(None))) else fl.value) for fl in fr_.fields if fl.value is not None})
print(dict(msgs))
print('Felder:',sorted(set(k for r in recs for k in r)))
for k in ('session','sport','bike_profile','user_profile'):
  for o in other.get(k,[])[:2]:print(k,json.dumps(o,ensure_ascii=False,default=str)[:900])
for o in other.get('device_info',[])[:6]:print('dev',{k:o.get(k) for k in ('manufacturer','product','product_name','device_type','antplus_device_type','source_type','serial_number')})
ev=[o for o in other.get('event',[])];print('events',ev[:6])
json.dump([{k:(v if isinstance(v,(int,float)) else str(v)) for k,v in r.items()} for r in recs],open(sys.argv[2],'w'))
print(len(recs),'records',recs[0] if recs else '')
