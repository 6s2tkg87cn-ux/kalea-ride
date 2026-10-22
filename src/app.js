'use strict';
if(typeof THREE==='undefined'){document.getElementById('loading').textContent='Die 3D-Bibliothek konnte nicht geladen werden. Beim ersten Öffnen wird eine Internetverbindung benötigt.';throw new Error('THREE fehlt');}
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sat=v=>clamp(v,0,1);
const sstep=t=>{t=sat(t);return t*t*(3-2*t);};
const rnd=(a,b)=>a+Math.random()*(b-a);
let WORLD=(()=>{try{return localStorage.getItem('kalea_world')||'ulm';}catch(e){return 'ulm';}})();
let IS_ULM=WORLD==='ulm';
let ROUTE_ID=(()=>{try{return localStorage.getItem('kalea_route_'+WORLD)||'';}catch(e){return '';}})();
let ROUTE=null,CLIMBS=[];

/* ================= Einstellungen & Zustand ================= */
const VGEARS=[0.75,0.87,0.99,1.11,1.23,1.38,1.53,1.68,1.86,2.04,2.22,2.40,2.61,2.82,3.03,3.24,3.49,3.74,3.99,4.24,4.54,4.84,5.14,5.49];
let GEARS=VGEARS.slice(),GEAR_COMBO=[];
const CAS_PRESETS=[
  ['Shimano 12-fach 11-30','11,12,13,14,15,16,17,19,21,24,27,30'],
  ['Shimano 12-fach 11-34','11,12,13,14,15,17,19,21,24,27,30,34'],
  ['Shimano 12-fach 11-36','11,12,13,14,15,17,19,21,24,27,30,36'],
  ['Shimano 11-fach 11-28','11,12,13,14,15,17,19,21,23,25,28'],
  ['Shimano 11-fach 11-32','11,12,13,14,16,18,20,22,25,28,32'],
  ['Shimano 11-fach 11-34','11,13,15,17,19,21,23,25,27,30,34'],
  ['Shimano 10-fach 11-28','11,12,13,14,15,17,19,21,24,28'],
  ['SRAM 12-fach 10-28','10,11,12,13,14,15,16,17,19,21,24,28'],
  ['SRAM 12-fach 10-33','10,11,12,13,14,15,17,19,21,24,28,33'],
  ['SRAM 12-fach 10-36','10,11,12,13,15,17,19,21,24,28,32,36'],
  ['SRAM XPLR 12-fach 10-44 (1x)','10,11,13,15,17,19,21,24,28,32,38,44'],
  ['Campagnolo 12-fach 11-32','11,12,13,14,15,16,17,19,22,25,28,32'],
];
const PHYS={g:9.81,rho:1.2,crr:0.004,cda:0.32,bike:9,circ:2.105};
// Fahrgefühl: „Realistisch“ ist auf echte Fahrten abgestimmt (Edge-540-Dateien: Rollwiderstand, Luftdichte nach Höhe,
// Kleidung/Flaschen, Abbremsen vor Kurven). „Leichtlauf“ rollt leichter und schneller (weniger Luftwiderstand).
const FEELS={real:{crr:0.005,cda:0.32,extra:2,alt:true,curves:true},std:{crr:0.004,cda:0.32,extra:0,alt:false,curves:false},light:{crr:0.004,cda:0.27,extra:0,alt:false,curves:false}};
function applyFeel(){const f=FEELS[S.feel]||FEELS.real;PHYS.crr=f.crr;PHYS.cda=f.cda;PHYS.bike=9+f.extra;if(!f.alt)PHYS.rho=1.2;}
const IS_MOBILE=/iPad|iPhone|iPod|Android/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const S={feel:'real',trMeas:0,tire:2.105,fps:60,shiftFeel:'soft',toon:true,mass:75,chain:34,cog:14,diff:1,vshift:true,gear:12,quality:IS_MOBILE?'low':'high',rings:'50/34',cassette:'11,12,13,14,15,17,19,21,24,27,30,34',gearMode:'std',repeat:220,smooth:0.6,erg:false,ergW:200,ftp:250,sndBike:0.6,sndAmb:0.5,mute:false,botMode:'me',botWkg:2.5,life:true,p30:0,
  power:0,cadence:0,hr:0,v:0,dist:0,elapsed:0,climb:0,lastH:null,
  riding:false,started:false,paused:false,sim:false,simPower:150,cam:0,legPhase:0,wheel:0};
const Z={learn:null,learnTimer:0,learned:{up:null,down:null},idle:new Map(),latch:0,log:[]};
function loadSettings(){try{const o=JSON.parse(localStorage.getItem('kalea')||'{}');
  if(o.mass)S.mass=o.mass;if(o.chain)S.chain=o.chain;if(o.cog)S.cog=o.cog;
  // Einstellungen von vor v2: die alte Vorgabe 50×17 auf 34×14 umstellen (festes Trainer-Ritzel hat 14 Zähne)
  const oldDef=!o.sv&&(!o.chain||o.chain===50)&&(!o.cog||o.cog===17);if(oldDef){S.chain=34;S.cog=14;}
  if(o.diff)S.diff=o.diff;if(o.quality&&!(IS_MOBILE&&!o.qualitySetOnMobile))S.quality=o.quality;S.qualitySetOnMobile=!!o.qualitySetOnMobile;if(o.rings)S.rings=o.rings;if(o.cassette)S.cassette=o.cassette;if(o.gearMode)S.gearMode=o.gearMode==='zwift'?'std':o.gearMode;if(o.repeat!==undefined)S.repeat=o.repeat;if(o.smooth!==undefined)S.smooth=o.smooth;if(o.ftp)S.ftp=o.ftp;if(o.ergW)S.ergW=o.ergW;
  if(typeof o.vshift==='boolean')S.vshift=o.vshift;if(typeof o.toon==='boolean')S.toon=o.toon;if(o.shiftFeel)S.shiftFeel=o.shiftFeel;if(o.fps)S.fps=o.fps;if(o.tire)S.tire=o.tire;if(['me','solo','fixed','off'].includes(o.botMode))S.botMode=o.botMode;if(o.botWkg)S.botWkg=o.botWkg;if(typeof o.life==='boolean')S.life=o.life;if(typeof o.sndBike==='number')S.sndBike=o.sndBike;if(typeof o.sndAmb==='number')S.sndAmb=o.sndAmb;if(typeof o.mute==='boolean')S.mute=o.mute;if(o.trMeas&&o.trGear&&!(oldDef&&o.trGear!=='34×14')){S.trMeas=o.trMeas;S.trGear=o.trGear;}if(oldDef&&Object.keys(o).length)setTimeout(saveSettings,0);if(o.feel==='zwift')o.feel='light';if(o.feel&&FEELS[o.feel])S.feel=o.feel;applyFeel();PHYS.circ=S.tire;if(o.learned)Z.learned=o.learned;}catch(e){}}
function saveSettings(){try{localStorage.setItem('kalea',JSON.stringify({sv:2,botMode:S.botMode,botWkg:S.botWkg,life:S.life,sndBike:S.sndBike,sndAmb:S.sndAmb,mute:S.mute,feel:S.feel,trMeas:S.trMeas,trGear:S.trGear,tire:S.tire,fps:S.fps,shiftFeel:S.shiftFeel,qualitySetOnMobile:S.qualitySetOnMobile,toon:S.toon,mass:S.mass,chain:S.chain,cog:S.cog,diff:S.diff,vshift:S.vshift,quality:S.quality,rings:S.rings,cassette:S.cassette,gearMode:S.gearMode,repeat:S.repeat,smooth:S.smooth,ftp:S.ftp,ergW:S.ergW,learned:Z.learned}));}catch(e){}}

/* ================= Welt: Gelände ================= */
const VOLC={x:700,z:-500,h:330,r:1300};
const TS=7400;
function n2(x,z){return Math.sin(x*0.0021+1.3)*Math.cos(z*0.0017+0.7)*18+Math.sin(x*0.0057+z*0.0043+2.1)*8+Math.cos(x*0.013-z*0.011)*3;}
function rawHeight(x,z){
  if(IS_ULM)return ulmHeight(x,z);
  const d=Math.hypot(x,z);
  const island=1-sstep((d-2400)/900);
  let h=island*(28+n2(x,z))-(1-island)*40;
  const dv=Math.hypot(x-VOLC.x,z-VOLC.z);
  if(dv<VOLC.r){const t=1-dv/VOLC.r;let cone=VOLC.h*Math.pow(t,1.6);if(dv<140)cone-=(140-dv)*0.85;h+=cone*island;}
  return h;
}
function patch(x,z){return Math.sin(x*0.011+z*0.004)*Math.cos(z*0.013-x*0.003)*0.5+Math.sin(x*0.037+z*0.029)*0.3+Math.sin(x*0.09-z*0.07)*0.2;}
function slopeY(x,z){const e=4,dx=(rawHeight(x+e,z)-rawHeight(x-e,z))/(2*e),dz=(rawHeight(x,z+e)-rawHeight(x,z-e))/(2*e);return 1/Math.sqrt(1+dx*dx+dz*dz);}

/* ================= Strecke ================= */
const CTRL=[[0,2150],[1100,1950],[1900,1300],[2250,350],[2000,-400],[1550,-950],[1000,-1150],[500,-1000],[150,-700],[-250,-1150],[-700,-1500],[-1500,-1350],[-2150,-550],[-2250,450],[-1750,1450],[-850,2050]];
const KALEA_ROUTES=[
  {id:'insel',name:'Inselrunde',desc:'Der Klassiker: Palmenstrand, Fischerdorf, hinauf an die Vulkanflanke und zurück an die Küste.',ctrl:CTRL},
  {id:'kueste',name:'Küstenrunde (flach)',desc:'Einmal rund um die Insel, immer nah am Meer – nur sanfte Wellen.',pts:[[7,2066],[-20,2067],[-47,2068],[-75,2068],[-102,2068],[-129,2067],[-156,2066],[-183,2064],[-210,2062],[-237,2059],[-264,2056],[-291,2053],[-318,2049],[-344,2045],[-371,2040],[-398,2035],[-424,2030],[-451,2024],[-477,2018],[-504,2011],[-530,2004],[-556,1997],[-582,1989],[-608,1981],[-634,1972],[-659,1964],[-685,1955],[-710,1945],[-736,1936],[-761,1926],[-786,1916],[-811,1905],[-836,1894],[-861,1883],[-885,1872],[-910,1860],[-934,1849],[-959,1837],[-983,1824],[-1007,1812],[-1031,1799],[-1055,1786],[-1078,1773],[-1102,1759],[-1126,1746],[-1149,1732],[-1172,1718],[-1196,1703],[-1219,1689],[-1242,1674],[-1265,1659],[-1287,1644],[-1310,1628],[-1332,1613],[-1355,1597],[-1377,1580],[-1399,1564],[-1421,1547],[-1443,1530],[-1464,1513],[-1486,1495],[-1507,1478],[-1528,1459],[-1549,1441],[-1570,1422],[-1590,1403],[-1610,1384],[-1630,1365],[-1650,1345],[-1669,1324],[-1688,1304],[-1707,1283],[-1725,1262],[-1743,1241],[-1761,1219],[-1779,1197],[-1796,1174],[-1812,1152],[-1828,1129],[-1844,1105],[-1860,1082],[-1875,1058],[-1889,1034],[-1903,1009],[-1917,984],[-1930,959],[-1942,934],[-1954,909],[-1966,883],[-1977,857],[-1987,831],[-1997,804],[-2006,778],[-2015,751],[-2023,724],[-2031,697],[-2038,670],[-2044,642],[-2050,615],[-2056,587],[-2061,560],[-2065,532],[-2069,504],[-2072,476],[-2074,448],[-2076,420],[-2078,392],[-2079,364],[-2080,337],[-2080,309],[-2079,281],[-2078,253],[-2077,225],[-2075,198],[-2073,170],[-2070,143],[-2067,115],[-2064,88],[-2060,61],[-2056,34],[-2052,7],[-2047,-20],[-2042,-47],[-2037,-73],[-2031,-100],[-2025,-126],[-2019,-152],[-2013,-178],[-2007,-204],[-2000,-230],[-1993,-256],[-1986,-281],[-1979,-307],[-1972,-332],[-1964,-357],[-1957,-382],[-1949,-408],[-1942,-433],[-1934,-457],[-1926,-482],[-1918,-507],[-1910,-532],[-1902,-557],[-1894,-581],[-1885,-606],[-1877,-630],[-1869,-655],[-1860,-679],[-1852,-704],[-1843,-728],[-1834,-753],[-1826,-777],[-1817,-802],[-1808,-826],[-1799,-851],[-1789,-875],[-1780,-900],[-1770,-924],[-1761,-949],[-1751,-973],[-1741,-998],[-1730,-1022],[-1720,-1046],[-1709,-1071],[-1698,-1095],[-1687,-1120],[-1676,-1144],[-1664,-1168],[-1652,-1192],[-1640,-1216],[-1627,-1240],[-1614,-1264],[-1601,-1288],[-1587,-1312],[-1573,-1335],[-1559,-1359],[-1544,-1382],[-1529,-1405],[-1514,-1428],[-1498,-1450],[-1482,-1473],[-1466,-1495],[-1449,-1517],[-1431,-1539],[-1414,-1560],[-1395,-1581],[-1377,-1602],[-1358,-1622],[-1339,-1642],[-1319,-1662],[-1299,-1681],[-1278,-1700],[-1257,-1719],[-1236,-1737],[-1214,-1755],[-1192,-1772],[-1170,-1789],[-1147,-1805],[-1124,-1821],[-1101,-1837],[-1077,-1852],[-1053,-1866],[-1029,-1880],[-1004,-1894],[-980,-1907],[-954,-1920],[-929,-1932],[-904,-1943],[-878,-1955],[-852,-1965],[-826,-1976],[-800,-1985],[-773,-1995],[-747,-2003],[-720,-2012],[-693,-2020],[-666,-2027],[-639,-2034],[-612,-2041],[-585,-2047],[-557,-2053],[-530,-2058],[-502,-2063],[-475,-2067],[-447,-2071],[-420,-2075],[-392,-2079],[-365,-2082],[-337,-2084],[-310,-2087],[-282,-2089],[-254,-2091],[-227,-2092],[-199,-2093],[-172,-2094],[-144,-2094],[-117,-2094],[-89,-2094],[-62,-2094],[-34,-2093],[-7,-2092],[20,-2091],[48,-2090],[75,-2088],[102,-2086],[130,-2084],[157,-2081],[184,-2078],[211,-2075],[238,-2072],[265,-2068],[292,-2065],[319,-2060],[346,-2056],[373,-2051],[400,-2046],[427,-2041],[454,-2035],[480,-2029],[507,-2023],[533,-2016],[560,-2010],[586,-2002],[612,-1995],[638,-1987],[664,-1979],[690,-1970],[716,-1961],[742,-1952],[767,-1942],[793,-1932],[818,-1921],[843,-1910],[868,-1899],[893,-1887],[918,-1876],[943,-1866],[970,-1858],[998,-1852],[1027,-1847],[1055,-1841],[1083,-1833],[1111,-1825],[1138,-1816],[1165,-1806],[1192,-1796],[1219,-1786],[1246,-1774],[1272,-1763],[1299,-1751],[1325,-1738],[1351,-1725],[1376,-1711],[1401,-1696],[1426,-1680],[1449,-1663],[1473,-1647],[1498,-1630],[1522,-1614],[1546,-1598],[1570,-1580],[1593,-1562],[1616,-1543],[1637,-1523],[1658,-1503],[1679,-1482],[1698,-1460],[1717,-1438],[1736,-1415],[1754,-1392],[1773,-1369],[1790,-1346],[1808,-1323],[1826,-1299],[1843,-1275],[1860,-1251],[1876,-1227],[1891,-1202],[1906,-1177],[1920,-1151],[1934,-1125],[1947,-1099],[1961,-1073],[1974,-1047],[1985,-1020],[1996,-993],[2005,-965],[2013,-936],[2020,-908],[2028,-879],[2035,-851],[2043,-823],[2049,-795],[2056,-766],[2063,-738],[2069,-710],[2074,-682],[2077,-653],[2079,-624],[2080,-594],[2080,-565],[2081,-536],[2081,-507],[2081,-478],[2081,-450],[2080,-421],[2080,-393],[2078,-364],[2076,-336],[2074,-308],[2070,-280],[2066,-252],[2065,-224],[2067,-197],[2072,-170],[2078,-143],[2085,-116],[2091,-89],[2096,-62],[2102,-34],[2107,-7],[2111,21],[2115,49],[2119,77],[2122,104],[2125,133],[2127,161],[2129,189],[2131,217],[2131,245],[2132,274],[2131,302],[2130,330],[2129,359],[2127,387],[2124,415],[2121,444],[2117,472],[2113,500],[2108,528],[2102,556],[2096,584],[2089,611],[2082,639],[2074,666],[2065,693],[2056,720],[2046,747],[2035,774],[2024,800],[2013,826],[2001,852],[1988,877],[1975,902],[1961,927],[1946,952],[1932,976],[1916,1000],[1901,1024],[1884,1047],[1868,1070],[1851,1093],[1833,1115],[1815,1137],[1797,1158],[1778,1180],[1759,1200],[1740,1221],[1720,1241],[1701,1261],[1680,1280],[1660,1300],[1639,1318],[1619,1337],[1598,1355],[1576,1373],[1555,1391],[1533,1408],[1512,1425],[1490,1442],[1468,1458],[1446,1474],[1424,1490],[1402,1506],[1379,1521],[1357,1537],[1334,1552],[1312,1566],[1289,1581],[1266,1596],[1244,1610],[1221,1624],[1198,1638],[1175,1651],[1152,1665],[1129,1678],[1106,1692],[1083,1705],[1060,1718],[1037,1730],[1014,1743],[991,1756],[967,1768],[944,1780],[921,1792],[897,1804],[873,1816],[850,1827],[826,1839],[802,1850],[778,1861],[754,1872],[730,1883],[705,1893],[681,1904],[657,1914],[632,1924],[607,1933],[582,1943],[557,1952],[532,1961],[507,1969],[482,1978],[456,1986],[430,1993],[405,2001],[379,2008],[353,2015],[327,2021],[301,2027],[274,2032],[248,2038],[221,2042],[195,2047],[168,2051],[141,2055],[115,2058],[88,2060],[61,2063],[34,2065]],flat:true},
  {id:'vulkan',name:'Vulkan-Bergfahrt',desc:'In weiten Spiralen bis an den Kraterrand (gut 280 m) und in Serpentinen wieder hinunter.',pts:[[688,960],[712,960],[737,959],[761,958],[786,957],[810,955],[835,953],[859,951],[884,948],[908,945],[932,941],[957,937],[981,932],[1005,927],[1029,922],[1053,916],[1076,910],[1100,904],[1124,897],[1147,889],[1170,882],[1194,874],[1217,865],[1240,856],[1262,847],[1285,837],[1307,827],[1330,817],[1352,806],[1374,795],[1395,783],[1417,772],[1438,759],[1459,747],[1480,734],[1501,720],[1521,707],[1541,693],[1561,678],[1581,664],[1600,649],[1620,633],[1639,618],[1657,602],[1676,586],[1694,569],[1712,552],[1729,535],[1746,518],[1763,500],[1780,482],[1797,463],[1813,445],[1828,426],[1844,407],[1859,387],[1874,368],[1888,348],[1902,328],[1916,308],[1929,287],[1942,266],[1955,245],[1967,224],[1979,202],[1991,181],[2002,159],[2013,137],[2024,115],[2034,92],[2044,70],[2053,47],[2062,24],[2071,1],[2079,-22],[2087,-45],[2094,-68],[2101,-92],[2108,-116],[2114,-139],[2120,-163],[2126,-187],[2131,-211],[2135,-235],[2140,-260],[2144,-284],[2147,-308],[2150,-333],[2153,-357],[2155,-381],[2157,-406],[2158,-430],[2159,-455],[2159,-479],[2156,-499],[2134,-500],[2114,-500],[2094,-500],[2074,-500],[2054,-500],[2034,-500],[2014,-500],[1994,-500],[1974,-500],[1953,-500],[1933,-500],[1913,-500],[1899,-495],[1894,-474],[1889,-454],[1884,-434],[1878,-414],[1872,-394],[1865,-374],[1858,-354],[1851,-334],[1843,-315],[1835,-295],[1827,-276],[1818,-257],[1809,-238],[1800,-219],[1790,-201],[1780,-182],[1769,-164],[1759,-146],[1747,-128],[1736,-111],[1724,-94],[1712,-77],[1699,-60],[1687,-43],[1673,-27],[1660,-11],[1646,5],[1632,21],[1618,36],[1603,51],[1588,65],[1572,80],[1557,94],[1541,107],[1525,121],[1508,134],[1492,146],[1475,159],[1457,171],[1440,182],[1422,193],[1404,204],[1386,215],[1367,225],[1349,234],[1330,243],[1311,252],[1292,260],[1272,268],[1253,276],[1233,283],[1213,289],[1193,295],[1173,301],[1152,306],[1132,311],[1111,315],[1091,319],[1070,322],[1049,325],[1029,327],[1008,329],[987,330],[966,331],[945,331],[924,330],[903,329],[882,328],[861,326],[840,324],[820,321],[799,317],[778,313],[758,309],[737,304],[717,299],[697,293],[677,287],[657,280],[637,273],[618,265],[599,257],[580,248],[561,239],[542,230],[524,220],[505,209],[488,198],[470,187],[453,175],[436,163],[419,150],[403,137],[387,123],[372,109],[357,94],[342,79],[328,64],[314,48],[301,32],[288,16],[275,-1],[264,-19],[252,-36],[241,-54],[231,-72],[222,-91],[212,-110],[204,-129],[196,-149],[189,-168],[182,-188],[176,-208],[171,-228],[167,-249],[163,-269],[160,-290],[157,-311],[155,-332],[154,-353],[154,-374],[154,-395],[156,-416],[158,-436],[160,-457],[164,-478],[168,-498],[173,-519],[179,-539],[185,-559],[193,-578],[201,-598],[209,-617],[219,-635],[229,-653],[240,-671],[252,-689],[265,-705],[278,-722],[292,-737],[306,-753],[321,-767],[337,-781],[353,-794],[370,-806],[388,-818],[406,-829],[424,-839],[443,-848],[462,-856],[482,-863],[502,-870],[522,-875],[542,-879],[563,-883],[584,-885],[605,-886],[626,-887],[647,-886],[667,-884],[688,-881],[709,-877],[729,-871],[749,-865],[768,-858],[787,-849],[806,-840],[824,-829],[842,-817],[858,-805],[874,-791],[889,-777],[903,-761],[916,-745],[929,-728],[940,-710],[950,-692],[958,-673],[966,-653],[972,-633],[976,-613],[980,-592],[982,-571],[982,-550],[981,-529],[978,-509],[974,-488],[969,-468],[962,-448],[953,-429],[943,-411],[932,-394],[919,-377],[905,-362],[889,-347],[873,-335],[855,-323],[837,-313],[818,-305],[798,-299],[777,-294],[757,-292],[736,-291],[715,-292],[696,-285],[696,-264],[695,-242],[695,-221],[694,-199],[694,-178],[693,-156],[693,-135],[708,-120],[729,-117],[750,-114],[771,-113],[792,-114],[813,-115],[834,-117],[855,-120],[876,-124],[896,-130],[916,-136],[936,-143],[955,-151],[974,-160],[993,-170],[1011,-181],[1028,-193],[1046,-205],[1062,-218],[1078,-232],[1093,-247],[1108,-262],[1122,-278],[1135,-294],[1147,-311],[1159,-328],[1170,-346],[1181,-364],[1190,-383],[1199,-402],[1207,-422],[1215,-441],[1221,-461],[1227,-482],[1232,-502],[1236,-523],[1240,-543],[1243,-564],[1244,-585],[1246,-606],[1246,-627],[1246,-648],[1245,-669],[1243,-690],[1240,-711],[1237,-732],[1233,-753],[1228,-773],[1223,-794],[1217,-814],[1210,-834],[1203,-854],[1195,-873],[1187,-892],[1177,-911],[1168,-930],[1157,-948],[1146,-966],[1135,-984],[1123,-1001],[1110,-1018],[1097,-1035],[1084,-1051],[1070,-1067],[1056,-1082],[1041,-1097],[1026,-1111],[1010,-1126],[994,-1139],[978,-1152],[961,-1165],[944,-1178],[926,-1189],[909,-1201],[891,-1212],[872,-1222],[854,-1232],[835,-1242],[816,-1251],[797,-1259],[777,-1267],[758,-1275],[738,-1282],[718,-1288],[698,-1295],[678,-1300],[657,-1305],[637,-1310],[616,-1314],[595,-1318],[575,-1321],[554,-1324],[533,-1327],[512,-1329],[491,-1330],[470,-1331],[449,-1331],[428,-1330],[407,-1330],[386,-1328],[365,-1326],[344,-1324],[323,-1321],[302,-1318],[282,-1314],[261,-1309],[241,-1305],[220,-1299],[200,-1293],[180,-1287],[160,-1280],[140,-1273],[121,-1265],[101,-1257],[82,-1249],[63,-1240],[44,-1231],[26,-1221],[7,-1211],[-11,-1200],[-29,-1189],[-47,-1178],[-64,-1166],[-81,-1154],[-98,-1141],[-115,-1129],[-131,-1115],[-147,-1102],[-163,-1088],[-179,-1074],[-194,-1059],[-209,-1045],[-224,-1029],[-238,-1014],[-252,-998],[-266,-982],[-279,-966],[-292,-950],[-305,-933],[-317,-916],[-329,-899],[-341,-881],[-352,-864],[-363,-846],[-374,-828],[-384,-809],[-394,-791],[-404,-772],[-413,-753],[-422,-734],[-431,-715],[-439,-696],[-447,-676],[-454,-657],[-461,-637],[-468,-617],[-475,-597],[-481,-577],[-486,-557],[-492,-536],[-496,-516],[-510,-500],[-530,-500],[-550,-500],[-570,-500],[-591,-500],[-611,-500],[-631,-500],[-651,-500],[-671,-500],[-691,-500],[-711,-500],[-731,-500],[-751,-500],[-759,-479],[-759,-455],[-758,-430],[-757,-406],[-755,-381],[-753,-357],[-750,-333],[-747,-308],[-744,-284],[-740,-260],[-735,-235],[-731,-211],[-726,-187],[-720,-163],[-714,-139],[-708,-116],[-701,-92],[-694,-68],[-687,-45],[-679,-22],[-671,1],[-662,24],[-653,47],[-644,70],[-634,92],[-624,115],[-613,137],[-602,159],[-591,181],[-579,202],[-567,224],[-555,245],[-542,266],[-529,287],[-516,308],[-502,328],[-488,348],[-474,368],[-459,387],[-444,407],[-428,426],[-413,445],[-397,463],[-380,482],[-363,500],[-346,518],[-329,535],[-312,552],[-294,569],[-276,586],[-257,602],[-239,618],[-220,633],[-200,649],[-181,664],[-161,678],[-141,693],[-121,707],[-101,720],[-80,734],[-59,747],[-38,759],[-17,772],[5,783],[26,795],[48,806],[70,817],[93,827],[115,837],[138,847],[160,856],[183,865],[206,874],[230,882],[253,889],[276,897],[300,904],[324,910],[347,916],[371,922],[395,927],[419,932],[443,937],[468,941],[492,945],[516,948],[541,951],[565,953],[590,955],[614,957],[639,958],[663,959]]}];
let N,L,ds,RX,RZ,RH,RG,RGS,RTX,RTZ,LAPCLIMB=0,KOM_I=0,MAXH=0;
const CELL=40,HASH=new Map();
const hkey=(ix,iz)=>ix*100000+iz;
function smoothCirc(a,w){const n=a.length,o=new Float32Array(n);let s=0;for(let k=-w;k<=w;k++)s+=a[(k+n)%n];
  for(let i=0;i<n;i++){o[i]=s/(2*w+1);s+=a[(i+w+1)%n]-a[(i-w+n)%n];}return o;}
function kaleaGeom(def){
  const P=def.ctrl||def.pts,curve=new THREE.CatmullRomCurve3(P.map(p=>new THREE.Vector3(p[0],0,p[1])),true,'centripetal');
  const L=curve.getLength(),N=Math.round(L/5),ds=L/N,pts=curve.getSpacedPoints(N);
  const RX=new Float32Array(N),RZ=new Float32Array(N);let H=new Float32Array(N);
  for(let i=0;i<N;i++){RX[i]=pts[i].x;RZ[i]=pts[i].z;H[i]=rawHeight(RX[i],RZ[i]);}
  const win=def.flat?500:120;H=smoothCirc(H,Math.round(win/ds));H=smoothCirc(H,Math.round(win/ds));
  const G=(def.flat?0.02:0.10)*ds;
  for(let pass=0;pass<4;pass++)for(let k=1;k<=N;k++){const i=k%N,p=(k-1)%N;
    if(H[i]>H[p]+G)H[i]=H[p]+G;else if(H[i]<H[p]-G)H[i]=H[p]-G;}
  H=smoothCirc(H,Math.round(30/ds));
  let gain=0;for(let i=0;i<N;i++){H[i]=Math.max(def.flat?4:3,H[i]);}
  for(let i=0;i<N;i++){const d=H[(i+1)%N]-H[i];if(d>0)gain+=d;}
  return {N,L,ds,RX,RZ,RH:H,gain};}
function buildRoute(){
  if(IS_ULM){buildRouteUlm();return;}
  ROUTE=KALEA_ROUTES.find(r=>r.id===ROUTE_ID)||KALEA_ROUTES[0];
  const g=kaleaGeom(ROUTE);N=g.N;L=g.L;ds=g.ds;RX=g.RX;RZ=g.RZ;RH=g.RH;RG=new Float32Array(N);RTX=new Float32Array(N);RTZ=new Float32Array(N);
  for(let i=0;i<N;i++){const a=(i-1+N)%N,b=(i+1)%N;
    RG[i]=(RH[b]-RH[a])/(2*ds);const tx=RX[b]-RX[a],tz=RZ[b]-RZ[a],l=Math.hypot(tx,tz)||1;RTX[i]=tx/l;RTZ[i]=tz/l;
    const dh=RH[b]-RH[i];if(dh>0)LAPCLIMB+=dh;if(RH[i]>MAXH){MAXH=RH[i];KOM_I=i;}
    const key=hkey(Math.floor(RX[i]/CELL),Math.floor(RZ[i]/CELL));if(!HASH.has(key))HASH.set(key,[]);HASH.get(key).push(i);}
  CLIMBS=detectClimbs();if(CLIMBS.length){const big=CLIMBS.slice().sort((a,b)=>b.gain-a.gain)[0];KOM_I=Math.round(big.end/ds)%N;}
}
// Anstiege automatisch finden (Kalea): Tal → Gipfel mit mind. 20 Hm und Ø ≥ 2,5 %
function detectClimbs(){
  const n=N,H=smoothCirc(RH,Math.max(1,Math.round(50/ds)));let i0=0;for(let i=1;i<n;i++)if(H[i]<H[i0])i0=i;
  const ext=[{i:i0,h:H[i0]}];let dir=1,cand={i:i0,h:H[i0]};
  for(let k=1;k<=n;k++){const i=(i0+k)%n,h=H[i];
    if(dir>0){if(h>cand.h)cand={i,h};else if(cand.h-h>12){ext.push(cand);dir=-1;cand={i,h};}}
    else{if(h<cand.h)cand={i,h};else if(h-cand.h>12){ext.push(cand);dir=1;cand={i,h};}}}
  if(dir>0)ext.push(cand);
  const out=[],used={};
  for(let k=0;k+1<ext.length;k+=2){let si=ext[k].i,ei=ext[k+1].i;const span=(ei-si+n)%n;if(span<4)continue;
    const gain0=ext[k+1].h-ext[k].h;if(gain0<20||gain0/(span*ds)<0.025)continue;
    for(let q=0;q<span-2;q++){const a=(si+1)%n;if((H[a]-H[si])/ds<0.012)si=a;else break;}
    for(let q=0;q<span-2;q++){const a=(ei-1+n)%n;if((H[ei]-H[a])/ds<0.012)ei=a;else break;}
    const len=((ei-si+n)%n)*ds,gain=H[ei]-H[si];if(gain<18)continue;let mx=0;for(let q=0;q<=(ei-si+n)%n;q++)mx=Math.max(mx,RG[(si+q)%n]);
    const dv=Math.hypot(RX[ei]-VOLC.x,RZ[ei]-VOLC.z);let nm=dv<450?'Kraterrand':dv<950?'Vulkanflanke':'Küstenhügel';
    used[nm]=(used[nm]||0)+1;if(used[nm]>1)nm+=' '+['','','II','III','IV'][Math.min(4,used[nm])];
    out.push({name:nm,start:si*ds,end:si*ds+len,len,gain,avg:Math.round(gain/len*1000)/10,max:Math.round(mx*1000)/10,top:H[ei],key:'kalea_'+ROUTE.id+'_'+out.length});}
  return out.sort((a,b)=>a.start-b.start);}
// Geglättete Steigung für „Sanftes Rollen“: kurze Wellen (< ca. 400 m) mitteln sich heraus, lange Anstiege bleiben
function buildSmoothGrade(){const w=Math.round(200/ds);RGS=smoothCirc(smoothCirc(RG,w),w);buildCurves();}
// Kurvenradien entlang der Strecke (über ca. 40 m gemessen) → Kurvengrenztempo für „Realistisch“
// VCOMF: wie draußen lässt man es bergab selten über ~58 km/h laufen (deine Abfahrten: 45–53 km/h im Rollen)
let RVMAX=null;const CURVE_ALAT=4.2,CURVE_DEC=3.0,VCOMF=16.1;
function buildCurves(){const k=Math.max(2,Math.round(20/ds)),v=new Float32Array(N);
  for(let i=0;i<N;i++){const a=(i-k+N)%N,b=(i+k)%N;let da=Math.atan2(RTZ[b],RTX[b])-Math.atan2(RTZ[a],RTX[a]);
    da=Math.abs(Math.atan2(Math.sin(da),Math.cos(da)));const R=da>0.02?2*k*ds/da:1e4;v[i]=Math.min(30,Math.sqrt(CURVE_ALAT*Math.max(R,6)));}
  // Bremsweg: vor einer engen Kurve rechtzeitig langsamer werden (rückwärts durchrechnen, zweimal für die Runde)
  for(let rep=0;rep<2;rep++)for(let q=N-1;q>=0;q--){const j=(q+1)%N;v[q]=Math.min(v[q],Math.sqrt(v[j]*v[j]+2*CURVE_DEC*ds));}
  RVMAX=v;}
function curveLimit(d){if(!RVMAX)return 99;const f=(((d%L)+L)%L)/ds,i=Math.floor(f)%N;return Math.min(RVMAX[i],RVMAX[(i+1)%N]);}
function gradeAt(d){const r=roadAt(d);if(!S.smooth)return r.grade;
  const dd=((d%L)+L)%L,f=dd/ds,i=Math.floor(f)%N,j=(i+1)%N,t=f-Math.floor(f),gs=RGS[i]+(RGS[j]-RGS[i])*t;
  return r.grade+(gs-r.grade)*S.smooth;}
function nearestRoad(x,z,maxR){
  const ix=Math.floor(x/CELL),iz=Math.floor(z/CELL),rr=Math.ceil(maxR/CELL);let best=maxR*maxR,bi=-1;
  for(let dx=-rr;dx<=rr;dx++)for(let dz=-rr;dz<=rr;dz++){const arr=HASH.get(hkey(ix+dx,iz+dz));if(!arr)continue;
    for(const i of arr){const ex=RX[i]-x,ez=RZ[i]-z,d2=ex*ex+ez*ez;if(d2<best){best=d2;bi=i;}}}
  return bi<0?null:{d:Math.sqrt(best),h:RH[bi],i:bi};
}
function blendRoad(h,nr){if(!nr)return h;const rh=nr.h-0.35,t=sstep((nr.d-8)/55);return rh+(h-rh)*t;}
function finalHeight(x,z){return blendRoad(rawHeight(x,z),nearestRoad(x,z,70));}
function roadAt(d){
  d=((d%L)+L)%L;const f=d/ds,i=Math.floor(f)%N,j=(i+1)%N,t=f-Math.floor(f);
  return {x:RX[i]+(RX[j]-RX[i])*t,z:RZ[i]+(RZ[j]-RZ[i])*t,h:RH[i]+(RH[j]-RH[i])*t,grade:RG[i]+(RG[j]-RG[i])*t,
    tx:RTX[i]+(RTX[j]-RTX[i])*t,tz:RTZ[i]+(RTZ[j]-RTZ[i])*t};
}
function lateralPoint(i,off){return [RX[i]-RTZ[i]*off,RZ[i]+RTX[i]*off];}

/* ================= Three.js Grundgerüst ================= */
const HORIZON=new THREE.Color(0xd3e5f1),SKYTOP=new THREE.Color(0x3a7fd0);
const SUN_DIR=new THREE.Vector3(0.55,0.62,0.32).normalize();
const FOG_DENS=(()=>{try{const o=JSON.parse(localStorage.getItem('kalea')||'{}');const q=(o.quality&&!(IS_MOBILE&&!o.qualitySetOnMobile))?o.quality:(IS_MOBILE?'low':'high');return q==='low'?0.00030:0.00021;}catch(e){return 0.00021;}})();
let renderer,scene,camera,sun,sky,water,player,BOTS=[],smoke=[],boats=[],lavaMat,lavaLight,clouds=[];
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
const anisotropy=()=>renderer.capabilities.getMaxAnisotropy();
function initScene(){
  renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:!S.toon&&S.quality!=='low',powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(HORIZON.getHex(),FOG_DENS);scene.background=HORIZON.clone();
  camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.3,20000);
  scene.add(new THREE.HemisphereLight(0xcfe6ff,0x6a7d48,0.62));
  scene.add(new THREE.AmbientLight(0xffffff,0.08));
  sun=new THREE.DirectionalLight(0xfff0d8,1.08);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  const sc=sun.shadow.camera;sc.left=-75;sc.right=75;sc.top=75;sc.bottom=-75;sc.near=20;sc.far=1000;
  sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.04;scene.add(sun,sun.target);
  addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
  applyQuality();
}
const PERF={scale:1,t0:0,frames:0,fps:60,lastF:0,sf:0};
function basePR(){const q=S.quality,mx=Math.sqrt(3.7e6/Math.max(1,innerWidth*innerHeight));return Math.max(0.5,Math.min(devicePixelRatio,q==='high'?2:q==='medium'?1.25:1,q==='high'?mx:mx*0.8));}
function applyQuality(){
  const q=S.quality,hi=q==='high';
  PERF.scale=q==='low'?0.85:1;renderer.setPixelRatio(basePR()*PERF.scale);renderer.setSize(innerWidth,innerHeight);
  {const ms=hi?2048:1024;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}}
  sun.castShadow=hi;if(scene.fog)scene.fog.density=q==='low'?0.00030:0.00021;GRASS_R=hi?420:q==='medium'?220:140;CULL_R=hi?7500:q==='medium'?5000:3200;LOD_R=hi?1100:q==='medium'?800:550;
}
// Auflösung automatisch anpassen, damit es flüssig bleibt (wichtig auf iPad/Tablet)
function perfTick(now){PERF.frames++;if(!PERF.t0){PERF.t0=now;return;}const el=now-PERF.t0;if(el<2000)return;
  PERF.fps=PERF.frames*1000/el;PERF.frames=0;PERF.t0=now;const f=$('vFps');if(f)f.textContent=`Aktuell ${Math.round(PERF.fps)} FPS · Auflösung ${Math.round(PERF.scale*100)} % · Wechsel lädt neu`;
  if(!S.started||S.paused)return;const min=S.quality==='high'?0.7:0.5;let ns=PERF.scale;
  if(PERF.fps<42&&ns>min)ns=Math.max(min,ns-0.1);else if(PERF.fps>56&&ns<1)ns=Math.min(1,ns+0.05);
  if(ns!==PERF.scale){PERF.scale=ns;renderer.setPixelRatio(basePR()*ns);renderer.setSize(innerWidth,innerHeight);}}
// Weit entfernte Kacheln (Häuser, Bäume) ausblenden
let CULL_R=1e9,LOD_R=1100;const CULLS=[];
function updateCull(){if(CULL_R>1e8)return;const cx=camera.position.x,cz=camera.position.z;for(const m of CULLS){const d=Math.hypot(m.position.x-cx,m.position.z-cz),l=m.userData.lod;
  m.visible=(!m.userData.life||S.life)&&d<CULL_R&&(l==='hi'?d<LOD_R:l==='lo'?d>=LOD_R:true);}}
let GRASS_R=420;
function updateGrass(){const cx=camera.position.x,cz=camera.position.z;
  for(const m of GRASS_CHUNKS)m.visible=Math.hypot(m.userData.cx-cx,m.userData.cz-cz)<GRASS_R;}

/* ---- Hilfen: Geometrie zusammenführen ---- */
function tr(geo,p=[0,0,0],r=[0,0,0],s=[1,1,1]){
  const m=new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0],r[1],r[2],'YXZ')),new THREE.Vector3(...s));
  const g=geo.index?geo.toNonIndexed():geo.clone();g.applyMatrix4(m);return g;}
function tube(a,b,r,seg=6){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),len=d.length();
  const g=new THREE.CylinderGeometry(r,r,len,seg).toNonIndexed();
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5),new THREE.Quaternion().setFromUnitVectors(UP,d.normalize()),new THREE.Vector3(1,1,1)));return g;}
function merge(parts){let n=0;for(const [g] of parts)n+=g.attributes.position.count;
  const P=new Float32Array(n*3),Nn=new Float32Array(n*3),C=new Float32Array(n*3),c=new THREE.Color();let o=0;
  // dritter Wert j: jede Dreiecksfläche bekommt eine leicht andere Helligkeit (Laub wirkt dichter und lebendiger)
  for(const [g,hex,j] of parts){c.set(hex);const cnt=g.attributes.position.count;P.set(g.attributes.position.array,o*3);Nn.set(g.attributes.normal.array,o*3);
    for(let i=0;i<cnt;i++){const f=j?1+(((Math.floor(i/3)+o)*2654435761>>>0)%1000/1000-0.5)*j:1;C[(o+i)*3]=c.r*f;C[(o+i)*3+1]=c.g*f;C[(o+i)*3+2]=c.b*f;}o+=cnt;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nn,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
  g.computeBoundingSphere();return g;}
function canvasTex(w,h,draw,repeat){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}t.anisotropy=anisotropy();return t;}
function softTex(){return canvasTex(128,128,(x,w,h)=>{const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.45,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});}

/* ---- Texturen (alle im Browser gezeichnet, nahtlos kachelbar) ---- */
// zeichnet ein Element so oft versetzt, dass es über den Rand hinweg nahtlos weiterläuft
function wrapDraw(w,h,cx,cy,m,fn){for(const ox of [0,-w,w])for(const oy of [0,-h,h]){if(ox&&(cx+ox<-m||cx+ox>w+m))continue;if(oy&&(cy+oy<-m||cy+oy>h+m))continue;fn(cx+ox,cy+oy);}}
// Wiese: Halme, Flecken, ein paar Blüten – fast farblos, die Farbe kommt aus den Eckpunkten des Geländes
function grassDetailTex(){return canvasTex(512,512,(x,w,h)=>{x.fillStyle='rgb(236,238,230)';x.fillRect(0,0,w,h);
  for(let k=0;k<80;k++){const cx=Math.random()*w,cy=Math.random()*h,r=14+Math.random()*55,v=Math.random()<0.55?196:255;
    wrapDraw(w,h,cx,cy,r,(X,Y)=>{const g=x.createRadialGradient(X,Y,0,X,Y,r);g.addColorStop(0,`rgba(${v},${v+3},${v-16},0.32)`);g.addColorStop(1,`rgba(${v},${v},${v},0)`);x.fillStyle=g;x.fillRect(X-r,Y-r,2*r,2*r);});}
  x.lineCap='round';
  for(let k=0;k<15000;k++){const cx=Math.random()*w,cy=Math.random()*h,a=-Math.PI/2+(Math.random()-0.5)*1.3,l=3+Math.random()*7,v=165+Math.random()*90|0,yg=(Math.random()*18-6)|0;
    x.strokeStyle=`rgb(${v-6},${Math.min(255,v+yg)},${Math.max(0,v-24)})`;x.lineWidth=0.7+Math.random()*0.9;
    wrapDraw(w,h,cx,cy,10,(X,Y)=>{x.beginPath();x.moveTo(X,Y);x.lineTo(X+Math.cos(a)*l,Y+Math.sin(a)*l);x.stroke();});}
  for(let k=0;k<240;k++){const cx=Math.random()*w,cy=Math.random()*h;x.fillStyle=Math.random()<0.6?'rgba(255,255,252,.9)':'rgba(255,238,130,.9)';wrapDraw(w,h,cx,cy,2,(X,Y)=>x.fillRect(X,Y,2,2));}},true);}
// Gelände: dieselbe Textur zusätzlich grob (≈ 7× größer) darüberlegen – so sieht man keine Kachel-Wiederholung
function detailBlend(mat){mat.userData.det=true;mat.customProgramCacheKey=()=>'det2';
  mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
    '#ifdef USE_MAP\n vec4 texelColor=texture2D(map,vUv);vec4 tc2=texture2D(map,vUv*0.143+vec2(0.37,0.11));\n texelColor=mapTexelToLinear(texelColor*mix(vec4(1.0),tc2*1.18,0.55));diffuseColor*=texelColor;\n#endif');};return mat;}
// Asphalt mit Splitt, Flickstellen, Rissen, Fahrspuren, Rinne und abgefahrener Markierung
function asphaltTex(w,h,o){return canvasTex(w,h,(x)=>{const im=x.createImageData(w,h),D=im.data;
  for(let i=0;i<w*h;i++){const r=Math.random(),v=r<0.12?62+r*300:r>0.93?120+(r-0.93)*600:80+(r-0.12)*18;D[i*4]=v;D[i*4+1]=v;D[i*4+2]=v+3;D[i*4+3]=255;}x.putImageData(im,0,0);
  for(let k=0;k<w*h/600;k++){const v=150+Math.random()*60|0;x.fillStyle=`rgba(${v},${v-4},${v-10},.8)`;x.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);}
  for(let k=0;k<h/70;k++){const pw=w*(0.12+Math.random()*0.3),ph=h*(0.006+Math.random()*0.025),px=w*0.08+Math.random()*(w*0.84-pw),py=Math.random()*h;
    x.fillStyle=Math.random()<0.5?'rgba(28,28,32,.08)':'rgba(140,140,146,.06)';wrapDraw(w,h,px,py,ph,(X,Y)=>x.fillRect(X,Y,pw,ph));}
  x.strokeStyle='rgba(22,22,25,.32)';for(let k=0;k<h/220;k++){let cx=w*(0.1+Math.random()*0.8),cy=Math.random()*h;x.lineWidth=0.6+Math.random()*0.6;x.beginPath();x.moveTo(cx,cy);
    for(let q=0;q<10;q++){cx+=(Math.random()-0.5)*w*0.05;cy+=Math.random()*h*0.01;x.lineTo(cx,cy);}x.stroke();}
  for(const c of [0.27,0.73]){const g=x.createLinearGradient(w*(c-0.07),0,w*(c+0.07),0);g.addColorStop(0,'rgba(30,30,34,0)');g.addColorStop(0.5,'rgba(30,30,34,.22)');g.addColorStop(1,'rgba(30,30,34,0)');x.fillStyle=g;x.fillRect(w*(c-0.07),0,w*0.14,h);}
  const gut=o.gutter||0.035;x.fillStyle='#a19d96';x.fillRect(0,0,w*gut,h);x.fillRect(w*(1-gut),0,w*gut,h);
  for(let k=0;k<h/3;k++){const v=130+Math.random()*60|0;x.fillStyle=`rgb(${v},${v-3},${v-8})`;x.fillRect(Math.random()<0.5?Math.random()*w*gut:w*(1-gut)+Math.random()*w*gut,Math.random()*h,2,2);}
  x.fillStyle='rgba(60,58,55,.6)';for(let y=0;y<h;y+=h/36){x.fillRect(0,y,w*gut,1.2);x.fillRect(w*(1-gut),y,w*gut,1.2);}
  x.fillStyle='#ecebe4';if(o.edge){x.fillRect(w*o.edge,0,w*0.028,h);x.fillRect(w*(1-o.edge-0.028),0,w*0.028,h);}
  if(o.center)x.fillRect(w*0.488,0,w*0.024,h/3);
  for(let k=0;k<h*2;k++){x.fillStyle='rgba(87,89,93,.55)';const lx=o.edge&&Math.random()<0.66?(Math.random()<0.5?w*o.edge:w*(1-o.edge-0.028)):w*0.488;x.fillRect(lx+Math.random()*w*0.028,Math.random()*h,1.4,1.4);}},true);}
// Fassade für echte Häuser: eine Fensterachse × ein Stockwerk, Putz mit Wetterspuren, Rahmen, Sims, Sturz
function winTile(){const t=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#ffffff';x.fillRect(0,0,w,h);
    for(let k=0;k<1400;k++){const v=228+Math.random()*27|0;x.fillStyle=`rgb(${v},${v},${v-4})`;x.fillRect(Math.random()*w,Math.random()*h,2,2);}
    const g0=x.createLinearGradient(0,h*0.78,0,h);g0.addColorStop(0,'rgba(120,115,105,0)');g0.addColorStop(1,'rgba(120,115,105,.18)');x.fillStyle=g0;x.fillRect(0,h*0.78,w,h*0.22);
    x.fillStyle='rgba(0,0,0,.07)';x.fillRect(0,0,w,3);
    const wx=34,wy=20,ww=60,wh=74;x.fillStyle='rgba(0,0,0,.16)';x.fillRect(wx-6,wy-9,ww+12,6); // Sturz
    x.fillStyle='#e6e2d8';x.fillRect(wx-5,wy-4,ww+10,wh+8);
    const gl=x.createLinearGradient(0,wy,0,wy+wh);gl.addColorStop(0,'#2f3f50');gl.addColorStop(0.55,'#4f6880');gl.addColorStop(1,'#7f98ad');x.fillStyle=gl;x.fillRect(wx,wy,ww,wh);
    x.fillStyle='rgba(255,255,255,.22)';x.beginPath();x.moveTo(wx+8,wy);x.lineTo(wx+26,wy);x.lineTo(wx+6,wy+wh);x.lineTo(wx,wy+wh);x.lineTo(wx,wy+18);x.fill();
    x.fillStyle='#e6e2d8';x.fillRect(wx+ww/2-2,wy,4,wh);x.fillRect(wx,wy+wh*0.36,ww,3.5);
    x.fillStyle='#d4d0c6';x.fillRect(wx-8,wy+wh+4,ww+16,6);x.fillStyle='rgba(0,0,0,.18)';x.fillRect(wx-8,wy+wh+10,ww+16,3); // Sims mit Schatten
    const g1=x.createLinearGradient(0,wy+wh+13,0,h);g1.addColorStop(0,'rgba(90,85,75,.12)');g1.addColorStop(1,'rgba(90,85,75,0)');x.fillStyle=g1;x.fillRect(wx-4,wy+wh+13,ww+8,h-(wy+wh+13));},true);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
// Dachziegel (Biberschwanz-artig), 16 Reihen × 12 Spalten je Kachel
function roofTileTex(){return canvasTex(256,256,(x,w,h)=>{x.fillStyle='#d9d9d9';x.fillRect(0,0,w,h);const R=16,C=12,rh=h/R,cw=w/C;
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){const v=200+Math.random()*55|0,ox=(r%2)*cw/2,X=c*cw+ox,Y=r*rh;
    for(const dx of [0,-w])if(X+dx>-cw&&X+dx<w){x.fillStyle=`rgb(${v},${v},${v})`;x.beginPath();x.moveTo(X+dx+1,Y);x.lineTo(X+dx+cw-1,Y);x.lineTo(X+dx+cw-1,Y+rh*0.7);x.quadraticCurveTo(X+dx+cw/2,Y+rh*1.08,X+dx+1,Y+rh*0.7);x.closePath();x.fill();}}
  for(let r=0;r<R;r++){x.fillStyle='rgba(0,0,0,.22)';x.fillRect(0,r*rh,w,1.5);}
  for(let k=0;k<500;k++){x.fillStyle=Math.random()<0.5?'rgba(40,50,30,.18)':'rgba(255,255,255,.12)';x.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*3,1.5);}},true);}
/* ---- Himmel ---- */
function buildSky(){
  const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:SKYTOP},hor:{value:HORIZON},sunDir:{value:SUN_DIR}},
    vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 top,hor,sunDir;varying vec3 vD;
      void main(){vec3 d=normalize(vD);float h=max(d.y,0.0);
        vec3 c=mix(hor,top,pow(h,0.55));
        float s=max(dot(d,sunDir),0.0);
        c+=vec3(1.0,0.86,0.62)*pow(s,10.0)*0.28+vec3(1.0,0.95,0.85)*pow(s,900.0)*3.0+vec3(1.0,0.9,0.75)*pow(s,120.0)*0.4;
        if(d.y<0.0)c=hor;
        gl_FragColor=vec4(c,1.0);}`});
  sky=new THREE.Mesh(new THREE.SphereGeometry(15000,40,20),m);sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
  if(IS_ULM){buildSkyExtrasUlm();return;}
  // ferne Inseln am Horizont
  [[9500,-4000,1900,420],[-8500,6500,2400,560],[-2000,-10500,1500,330],[7000,8500,1200,260]].forEach(([x,z,r,h],k)=>{
    const g=new THREE.SphereGeometry(1,28,10,0,Math.PI*2,0,Math.PI/2),pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i),a=Math.atan2(pz,px);const n=1+0.18*Math.sin(a*3+k)+0.1*Math.sin(a*7+k*2);pos.setXYZ(i,px*r*n,py*h*(1+0.25*Math.sin(a*2+k)),pz*r*0.6*n);}
    g.computeVertexNormals();const m2=new THREE.MeshLambertMaterial({color:new THREE.Color(0x4f9a5a).lerp(HORIZON,0.45),fog:false,flatShading:true});const s2=new THREE.Mesh(g,m2);s2.position.set(x,-8,z);scene.add(s2);});
}

/* ---- Gelände ---- */
let heightTex;
function buildTerrain(){
  if(IS_ULM){buildTerrainUlm();return;}
  const SEG=S.quality==='high'?360:S.quality==='medium'?260:180,g=new THREE.PlaneGeometry(TS,TS,SEG,SEG);g.rotateX(-Math.PI/2);
  const pos=g.attributes.position,near=new Float32Array(pos.count);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),nr=nearestRoad(x,z,70);pos.setY(i,blendRoad(rawHeight(x,z),nr));near[i]=nr?nr.d:99;}
  setTerr(-TS/2,-TS/2,TS/SEG,TS/SEG,SEG+1,SEG+1,pos);
  g.computeVertexNormals();
  const nor=g.attributes.normal,cols=new Float32Array(pos.count*3),c=new THREE.Color(),t=new THREE.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=pos.getY(i),ny=nor.getY(i),dv=Math.hypot(x-VOLC.x,z-VOLC.z),p=patch(x,z);
    if(h<0.7)c.setRGB(0.63,0.55,0.38);
    else{
      c.setRGB(0.36+p*0.07,0.53+p*0.08,0.22+p*0.02);t.setRGB(0.50,0.56,0.27);c.lerp(t,sstep((patch(x*1.7+300,z*1.7)-0.1)/0.5)*0.45);
      const jungle=sstep((-x-120)/520);t.setRGB(0.17,0.38+p*0.05,0.14);c.lerp(t,jungle);
      t.setRGB(0.64,0.60,0.36);c.lerp(t,sstep((p-0.35)/0.3)*0.55*(1-jungle));
      t.setRGB(0.91,0.83,0.62);c.lerp(t,1-sstep((h-3.5)/4.5));
      {const band=0.5+0.5*Math.sin(h*0.32+p*3.0);t.setRGB(0.44-band*0.12,0.37-band*0.09,0.32-band*0.08);c.lerp(t,sstep((0.88-ny)/0.12)*0.92);}
      t.setRGB(0.34,0.30,0.28);c.lerp(t,sstep((h-115)/80)*sat(1.35-dv/VOLC.r));
      t.setRGB(0.15,0.13,0.12);c.lerp(t,sstep((270-dv)/120));
      if(near[i]<12)c.lerp(t.setRGB(0.56,0.49,0.37),0.6*(1-sstep((near[i]-8)/4)));
    }
    cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));
  const detail=grassDetailTex();detail.repeat.set(TS/7,TS/7);
  const mesh=new THREE.Mesh(g,detailBlend(new THREE.MeshStandardMaterial({vertexColors:true,map:detail,roughness:1,metalness:0})));
  mesh.receiveShadow=true;scene.add(mesh);
  // Höhenkarte für das Wasser (Uferschaum, Flachwasser)
  const HS=256,data=new Uint8Array(HS*HS*4);
  for(let j=0;j<HS;j++)for(let i=0;i<HS;i++){const x=(i/(HS-1)-0.5)*TS,z=(j/(HS-1)-0.5)*TS,v=clamp((rawHeight(x,z)+40)/50,0,1)*255;const o=(j*HS+i)*4;data[o]=v;data[o+1]=v;data[o+2]=v;data[o+3]=255;}
  heightTex=new THREE.DataTexture(data,HS,HS,THREE.RGBAFormat);heightTex.magFilter=heightTex.minFilter=THREE.LinearFilter;heightTex.needsUpdate=true;
}

/* ---- Wasser ---- */
function buildWater(){
  if(IS_ULM){buildRiverUlm();return;}
  const m=new THREE.ShaderMaterial({fog:false,
    uniforms:{time:{value:0},sunDir:{value:SUN_DIR},deep:{value:new THREE.Color(0x0b4a78)},shallow:{value:new THREE.Color(0x2fb3ad)},
      skyCol:{value:new THREE.Color(0xa7cfec)},fogColor:{value:HORIZON},fogDensity:{value:FOG_DENS},hmap:{value:heightTex},hsize:{value:TS}},
    vertexShader:'varying vec3 wp;void main(){vec4 w=modelMatrix*vec4(position,1.0);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float time,fogDensity,hsize;uniform vec3 sunDir,deep,shallow,skyCol,fogColor;uniform sampler2D hmap;varying vec3 wp;
      float H(vec2 p){float t=time;
        return sin(dot(p,vec2(0.040,0.012))+t*0.9)*0.50+sin(dot(p,vec2(-0.025,0.050))+t*1.1)*0.40
             +sin(dot(p,vec2(0.13,0.09))+t*1.7)*0.12+sin(dot(p,vec2(-0.21,0.17))+t*2.3)*0.07
             +sin(dot(p,vec2(0.50,-0.37))+t*3.1)*0.035+sin(dot(p,vec2(-0.83,-0.61))+t*4.3)*0.018;}
      void main(){
        vec2 p=wp.xz;float dist=length(cameraPosition-wp);float e=0.6;
        float fade=1.0-smoothstep(300.0,3500.0,dist);
        vec2 gr=vec2(H(p+vec2(e,0.0))-H(p-vec2(e,0.0)),H(p+vec2(0.0,e))-H(p-vec2(0.0,e)))/(2.0*e);
        vec3 n=normalize(vec3(-gr.x*fade*1.6,1.0,-gr.y*fade*1.6));
        vec3 v=normalize(cameraPosition-wp);
        float fres=pow(1.0-max(dot(n,v),0.0),4.0);
        vec2 uv=p/hsize+0.5;float th=-40.0;
        if(uv.x>0.0&&uv.x<1.0&&uv.y>0.0&&uv.y<1.0)th=texture2D(hmap,uv).r*50.0-40.0;
        float depth=max(0.3-th,0.0);
        vec3 wc=mix(shallow,deep,smoothstep(0.0,16.0,depth));
        vec3 col=mix(wc,skyCol,0.10+fres*0.75);
        vec3 r=reflect(-v,n);col+=vec3(1.0,0.95,0.85)*(pow(max(dot(r,sunDir),0.0),220.0)*1.6+pow(max(dot(r,sunDir),0.0),20.0)*0.08);
        float foam=(1.0-smoothstep(0.0,1.6,depth))*(0.55+0.45*sin(time*1.4+p.x*0.25+p.y*0.18));
        col=mix(col,vec3(0.97,0.98,1.0),clamp(foam,0.0,1.0)*0.75);
        float f=1.0-exp(-pow(fogDensity*dist,2.0));col=mix(col,fogColor,f);
        gl_FragColor=vec4(col,1.0);}`});
  water=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000,1,1),m);water.rotation.x=-Math.PI/2;water.position.y=0.3;scene.add(water);
}

/* ---- Straße ---- */
function buildRoad(){
  const tex=asphaltTex(512,2048,{edge:0.06,center:true});
  tex.wrapS=THREE.ClampToEdgeWrapping;
  const W=4.6,P=[],UV=[],I=[];
  const CO=[];
  for(let k=0;k<=N;k++){const i=k%N,[lx,lz]=lateralPoint(i,-W),[rx,rz]=lateralPoint(i,W),y=RH[i]+0.25,v=k*ds/18,d=k*ds;
    // Belag wechselt alle paar hundert Meter leicht (neuer / alter Asphalt) – keine sichtbare Wiederholung
    const c=0.93+0.045*Math.sin(d*0.0071+1.3)+0.03*Math.sin(d*0.023+0.4)+0.02*Math.sin(d*0.061+2.2);
    P.push(lx,y,lz,rx,y,rz);UV.push(0,v,1,v);CO.push(c,c,c*1.01,c,c,c*1.01);
    if(k<N){const a=k*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(CO,3));g.setIndex(I);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tex,vertexColors:true,roughness:0.88,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  mesh.receiveShadow=true;scene.add(mesh);
  // seitliche Blenden: das Gelände liegt unter der Fahrbahn etwas tiefer (keine Hänge über dem Rand), die Blenden verdecken die Kante
  {const SP=[],SI=[];for(const sd of [-1,1]){const o=SP.length/3;for(let k=0;k<=N;k++){const i=k%N,[ax,az]=lateralPoint(i,sd*W),[bx,bz]=lateralPoint(i,sd*(W+0.35));
      SP.push(ax,RH[i]+0.24,az,bx,RH[i]-1.8,bz);if(k<N){const q=o+k*2;if(sd>0)SI.push(q,q+2,q+1,q+1,q+2,q+3);else SI.push(q,q+1,q+2,q+1,q+3,q+2);}}}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(SP,3));sg.setIndex(SI);sg.computeVertexNormals();
    const sk=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:IS_ULM?0x8c877e:0x9a8466,roughness:1,side:THREE.DoubleSide}));sk.receiveShadow=true;scene.add(sk);}
  // Leitpfosten
  const post=merge([[tr(new THREE.BoxGeometry(0.12,1.0,0.12),[0,0.5,0]),0xf4f4f0],[tr(new THREE.BoxGeometry(0.13,0.2,0.13),[0,0.85,0]),0x222222],[tr(new THREE.BoxGeometry(0.135,0.07,0.135),[0,0.85,0]),0xff6a1a]]);
  const step=Math.round(50/ds),cnt=Math.floor(N/step)*2,pm=new THREE.InstancedMesh(post,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.6}),cnt);
  const dm=new THREE.Object3D();let n2c=0;
  for(let i=0;i<N&&n2c<cnt;i+=step)for(const s of [-1,1]){const [x,z]=lateralPoint(i,s*6.0);if(IS_ULM&&riverDist(x,z).d<RIVER_HW+14)continue;dm.position.set(x,groundH(x,z),z);dm.rotation.set(0,Math.atan2(RTX[i],RTZ[i]),0);dm.updateMatrix();pm.setMatrixAt(n2c++,dm.matrix);}
  pm.count=n2c;pm.castShadow=true;pm.frustumCulled=false;scene.add(pm);
}

/* ---- Vegetation & Objekte ---- */
// Bäume & Büsche gibt es zweimal: fein für die Nähe, grob (ca. ¼ der Dreiecke) für die Ferne (scatter wählt je nach Abstand)
function withLo(g,lo){g.userData.lo=lo;return g;}
function palmGeo(lo){const parts=[],seg=new THREE.CylinderGeometry(0.16,0.22,1.5,lo?4:7);let x=0,y=0,a=0;
  for(let k=0;k<6;k++){parts.push([tr(seg,[x+Math.sin(a)*0.75,y+Math.cos(a)*0.75,0],[0,0,-a]),k%2?0x8c6c49:0x76583a]);x+=Math.sin(a)*1.5;y+=Math.cos(a)*1.5;a+=0.075;}
  const leaf=new THREE.ConeGeometry(0.55,3.8,lo?3:4),nf=lo?6:9;
  for(let f=0;f<nf;f++){const yaw=f/nf*Math.PI*2+0.3,b=Math.PI/2+0.25+(f%3)*0.12;
    parts.push([tr(leaf,[x+1.9*Math.sin(b)*Math.cos(yaw),y+1.9*Math.cos(b),-1.9*Math.sin(b)*Math.sin(yaw)],[0,yaw,-b],[1,1,0.22]),f%2?0x3f8c35:0x4f9c3f,0.25]);}
  if(!lo)for(let k=0;k<3;k++)parts.push([tr(new THREE.IcosahedronGeometry(0.2,0),[x+Math.cos(k*2.1)*0.3,y-0.3,Math.sin(k*2.1)*0.3]),0x6b4f2a]);
  return lo?merge(parts):withLo(merge(parts),palmGeo(true));}
function broadGeo(lo){const parts=[[tr(new THREE.CylinderGeometry(0.22,0.38,4.2,lo?4:7),[0,2.1,0]),0x6a4b30]];
  const ico=new THREE.IcosahedronGeometry(1,lo?0:1),cl=[0x3d7f34,0x4a8d3b,0x356f2d,0x447f37];
  [[0,5.6,0,2.6],[1.3,4.9,0.5,1.9],[-1.2,5.1,-0.4,2.0],[0.2,6.6,-0.9,1.7],[-0.4,4.6,1.2,1.6]].slice(0,lo?3:5).forEach(([x,y,z,s],k)=>parts.push([tr(ico,[x,y,z],[k,k*0.7,0],lo?[s*1.12,s*0.95,s*1.12]:[s,s*0.85,s]),cl[k%4],0.32]));
  return lo?merge(parts):withLo(merge(parts),broadGeo(true));}
function coniferGeo(lo){const parts=[[tr(new THREE.CylinderGeometry(0.18,0.3,3,lo?4:6),[0,1.5,0]),0x5a3f28]];
  [[2.4,3.4,2.8],[1.9,3.0,4.4],[1.35,2.6,5.9],[0.8,2.0,7.2]].forEach(([r,h,y],k)=>parts.push([tr(new THREE.ConeGeometry(r,h,lo?5:8),[0,y,0],[0,k*0.5,0]),k%2?0x2f5f2c:0x386b31,0.28]));
  return lo?merge(parts):withLo(merge(parts),coniferGeo(true));}
function bushGeo(lo){const ico=new THREE.IcosahedronGeometry(1,lo?0:1);
  const g=merge([[tr(ico,[0,0.6,0],[0,0,0],[1.2,0.8,1.1]),0x4a8a3a,0.3],[tr(ico,[0.8,0.45,0.3],[1,0,0],[0.8,0.6,0.8]),0x3f7e33,0.3],[tr(ico,[-0.6,0.4,-0.4],[0,1,0],[0.75,0.55,0.75]),0x559a42,0.3]]);
  return lo?g:withLo(g,bushGeo(true));}
function rockGeo(){return merge([[tr(new THREE.DodecahedronGeometry(1,0),[0,0.4,0],[0.3,0.5,0.1],[1.5,0.9,1.2]),0x8a847c],[tr(new THREE.DodecahedronGeometry(1,0),[0.9,0.2,0.4],[1,0,0.6],[0.6,0.5,0.6]),0x7b756e]]);}
function grassGeo(){const parts=[],blade=new THREE.ConeGeometry(0.06,0.55,3);
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2;parts.push([tr(blade,[Math.cos(a)*0.12,0.25,Math.sin(a)*0.12],[Math.sin(a)*0.35,a,Math.cos(a)*0.35],[1,0.7+((k*37)%10)/14,1]),k%2?0x7fae4c:0x6b9d3f]);}
  return merge(parts);}
// Instanzen werden in 500-m-Kacheln aufgeteilt, damit nur Sichtbares (auch im Schatten-Pass) gezeichnet wird
let CHUNK=500;const GRASS_CHUNKS=[];
function shareGeo(geo,ymid,radius){const g=new THREE.BufferGeometry();for(const k in geo.attributes)g.setAttribute(k,geo.attributes[k]);if(geo.index)g.setIndex(geo.index);
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,ymid,0),radius);g.boundingBox=null;return g;}
// Bodenhöhe genau so, wie das Geländenetz sie darstellt (damit nichts schwebt oder versinkt)
let TERR=null;
function setTerr(x0,z0,dx,dz,nx,nz,pos){const Y=new Float32Array(nx*nz);for(let i=0;i<Y.length;i++)Y[i]=pos.getY(i);TERR={x0,z0,dx,dz,nx,nz,Y};}
// Höhe genau so, wie das Geländenetz sie zeigt (grobe Zellen bzw. feine Zellen entlang der Strecke)
function terrH(x,z){const T=TERR;if(!T)return finalHeight(x,z);const fx=(x-T.x0)/T.dx,fz=(z-T.z0)/T.dz;if(fx<0||fz<0||fx>=T.nx-1||fz>=T.nz-1)return finalHeight(x,z);
  let ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,Y=T.Y,nx=T.nx;
  const F=T.FINE&&T.FINE.get(iz*T.SX+ix);if(F){const n=T.sub,gu=u*n,gv=v*n,ju=Math.min(n-1,Math.floor(gu)),jv=Math.min(n-1,Math.floor(gv));u=gu-ju;v=gv-jv;Y=F;nx=n+1;ix=ju;iz=jv;}
  const a=Y[iz*nx+ix],b=Y[(iz+1)*nx+ix],c=Y[(iz+1)*nx+ix+1],d=Y[iz*nx+ix+1];
  return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);}
function groundH(x,z){if(!TERR||nearestRoad(x,z,9.5))return finalHeight(x,z);return terrH(x,z);}
function scatter(geo,mat,count,pick,opts={}){
  const buckets=new Map(),dm=new THREE.Object3D(),col=new THREE.Color(),lo=geo.userData&&geo.userData.lo,CH=lo?CHUNK*1.5:CHUNK;let n=0,tries=0;
  if(S.quality==='low')count=Math.round(count*0.5);
  while(n<count&&tries<count*25){tries++;const p=pick();if(!p)continue;
    const [x,z,s]=p,key=Math.floor(x/CH)+'|'+Math.floor(z/CH);
    if(!buckets.has(key))buckets.set(key,{cx:(Math.floor(x/CH)+0.5)*CH,cz:(Math.floor(z/CH)+0.5)*CH,items:[]});
    buckets.get(key).items.push([x,groundH(x,z)-(opts.sink||0.2),z,s]);n++;}
  const meshes=[];
  for(const b of buckets.values()){let ymin=1e9,ymax=-1e9;for(const it of b.items){ymin=Math.min(ymin,it[1]);ymax=Math.max(ymax,it[1]);}
    const g=shareGeo(geo,(ymin+ymax)/2+5,CH*0.72+(ymax-ymin)/2+25);
    const mesh=new THREE.InstancedMesh(g,mat,b.items.length);mesh.position.set(b.cx,0,b.cz);
    b.items.forEach(([x,y,z,s],i)=>{dm.position.set(x-b.cx,y,z-b.cz);dm.rotation.set(opts.tilt?rnd(-0.08,0.08):0,Math.random()*6.28,opts.tilt?rnd(-0.08,0.08):0);
      dm.scale.set(s,s*rnd(0.9,1.25),s);dm.updateMatrix();mesh.setMatrixAt(i,dm.matrix);
      col.setHSL(0,0,1);col.offsetHSL(rnd(-0.02,0.02),0,rnd(-0.08,0.06));mesh.setColorAt(i,col);});
    mesh.castShadow=opts.shadow!==false;mesh.receiveShadow=!!opts.receive;mesh.userData.cx=b.cx;mesh.userData.cz=b.cz;scene.add(mesh);meshes.push(mesh);CULLS.push(mesh);
    if(lo){const ml=new THREE.InstancedMesh(shareGeo(lo,(ymin+ymax)/2+5,CH*0.72+(ymax-ymin)/2+25),mat,b.items.length);ml.position.copy(mesh.position);
      ml.instanceMatrix.copy(mesh.instanceMatrix);ml.instanceColor=mesh.instanceColor.clone();ml.castShadow=false;mesh.userData.lod='hi';ml.userData.lod='lo';scene.add(ml);CULLS.push(ml);}}
  return meshes;}
function landPoint(minRoad){const x=rnd(-3300,3300),z=rnd(-3300,3300),nr=nearestRoad(x,z,minRoad);if(nr)return null;
  const h=rawHeight(x,z);return {x,z,h,ny:slopeY(x,z),dv:Math.hypot(x-VOLC.x,z-VOLC.z)};}
function buildVegetation(){
  if(IS_ULM){buildVegetationUlm();return;}
  const fol=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9});
  const hi=S.quality==='high';
  scatter(palmGeo(),fol,hi?1800:1000,()=>{const p=landPoint(9);if(!p||p.h<2.5||p.h>22||p.ny<0.85)return null;return [p.x,p.z,rnd(0.8,1.2)];},{tilt:true});
  scatter(broadGeo(),fol,hi?4200:2500,()=>{const p=landPoint(10);if(!p||p.h<9||p.h>150||p.ny<0.8||p.dv<450)return null;
    if(p.x>-150&&Math.random()<0.55)return null;return [p.x,p.z,rnd(0.75,1.6)];});
  scatter(coniferGeo(),fol,hi?1300:800,()=>{const p=landPoint(10);if(!p||p.h<60||p.h>210||p.ny<0.78||p.dv<380)return null;return [p.x,p.z,rnd(0.8,1.4)];});
  scatter(bushGeo(),fol,hi?4500:2200,()=>{const p=landPoint(6.5);if(!p||p.h<5||p.h>170||p.ny<0.75)return null;return [p.x,p.z,rnd(0.6,1.5)];});
  scatter(rockGeo(),fol,hi?900:500,()=>{const p=landPoint(7);if(!p||p.h<3)return null;if(p.dv>VOLC.r*0.9&&p.ny>0.9&&Math.random()<0.85)return null;return [p.x,p.z,rnd(0.6,2.6)];},{sink:0.5});
  // dichter Bewuchs entlang der Straße
  scatter(bushGeo(),fol,hi?2600:1200,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(7.5,24),[x,z]=lateralPoint(i,off),h=rawHeight(x,z);
    if(h<5||Math.hypot(x-VOLC.x,z-VOLC.z)<300||nearestRoad(x,z,6.5))return null;return [x,z,rnd(0.5,1.2)];});
  scatter(broadGeo(),fol,hi?1500:800,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(11,45),[x,z]=lateralPoint(i,off),h=rawHeight(x,z);
    if(h<9||h>150||Math.hypot(x-VOLC.x,z-VOLC.z)<450||nearestRoad(x,z,10))return null;return [x,z,rnd(0.8,1.5)];});
  scatter(palmGeo(),fol,hi?700:400,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(9,40),[x,z]=lateralPoint(i,off),h=rawHeight(x,z);
    if(h<2.5||h>25||nearestRoad(x,z,9))return null;return [x,z,rnd(0.8,1.15)];},{tilt:true});
  GRASS_CHUNKS.push(...scatter(grassGeo(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),hi?26000:9000,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(5.2,30),[x,z]=lateralPoint(i,off),h=rawHeight(x,z);
    if(h<5.5||Math.hypot(x-VOLC.x,z-VOLC.z)<330)return null;return [x,z,rnd(0.8,1.8)];},{shadow:false,sink:0.05}));
}
// Stelle für einen Torbogen: beide Füße frei von anderen Streckenteilen (Kehren, Schleife am Ziel)
function archSpot(d){const ok=dd=>{const r=roadAt(dd),i0=Math.round((((dd%L)+L)%L)/ds)%N;for(const s of [-1,1]){const x=r.x-r.tz*s*6.4,z=r.z+r.tx*s*6.4,nr=nearestRoad(x,z,5);
    if(nr){const di=Math.abs(nr.i-i0),dc=Math.min(di,N-di);if(dc*ds>14)return false;}}return true;};
  for(let k=0;k<30;k++)for(const sg of [1,-1]){const dd=d+sg*k*3;if(ok(dd))return dd;}return d;}
function makeArch(d,text,color){
  d=archSpot(d);const r=roadAt(d),g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color,roughness:0.55});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(6.4,0.75,14,40,Math.PI),m);g.add(ring);
  [-6.4,6.4].forEach(x=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.0,0.6,14),new THREE.MeshStandardMaterial({color:0x333333}));b.position.set(x,0.3,0);g.add(b);});
  const tex=canvasTex(1024,160,(x,w,h)=>{x.fillStyle='#ffffff';x.fillRect(0,0,w,h);x.fillStyle=color;x.fillRect(0,0,w,14);x.fillRect(0,h-14,w,14);
    x.fillStyle='#14202e';let fs=92;do{x.font=`900 ${fs}px system-ui,sans-serif`;fs-=4;}while(x.measureText(text).width>w-40&&fs>30);x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,h/2+4);});
  for(const r of [0,Math.PI]){const ban=new THREE.Mesh(new THREE.PlaneGeometry(9.6,1.5),new THREE.MeshStandardMaterial({map:tex,roughness:0.7}));ban.position.set(0,5.2,r?0.06:-0.06);ban.rotation.y=r+Math.PI;g.add(ban);}
  g.position.set(r.x,r.h+0.2,r.z);g.rotation.y=Math.atan2(r.tx,r.tz);g.traverse(o=>{o.castShadow=true;});scene.add(g);
}
function buildLandmarks(){
  if(IS_ULM){buildLandmarksUlm();return;}
  // Dorf am Start
  const walls=[0xf3efe6,0xf2d7b6,0xd8e6ea,0xf5d2c6,0xfff6d8],rt=roofTileTex();rt.repeat.set(3,3);const roofM=new THREE.MeshStandardMaterial({color:0xc4573a,map:rt,roughness:0.8,flatShading:true});
  const winTex=winTile();winTex.repeat.set(2,2);
  for(let k=0;k<22;k++){const r=roadAt(130+k*45),side=k%2?1:-1,off=side*rnd(17,34);
    const x=r.x-r.tz*off,z=r.z+r.tx*off,h=finalHeight(x,z),w=rnd(5,8.5),hh=rnd(4,7);
    const house=new THREE.Group();
    const wm=new THREE.MeshStandardMaterial({color:walls[k%5],map:winTex,roughness:0.9});
    const body=new THREE.Mesh(new THREE.BoxGeometry(w,hh,w*0.8),wm);body.position.y=hh/2;
    const roof=new THREE.Mesh(new THREE.ConeGeometry(w*0.76,2.8,4),roofM);roof.position.y=hh+1.4;roof.rotation.y=Math.PI/4;roof.scale.z=0.82;
    house.add(body,roof);house.position.set(x,h-0.3,z);house.rotation.y=Math.atan2(r.tx,r.tz);house.traverse(o=>{o.castShadow=true;o.receiveShadow=true;});scene.add(house);}
  // Leuchtturm an der Ostküste
  let best=null;for(let i=0;i<N;i+=4){const x=RX[i],z=RZ[i];if(x<1900)continue;const d=Math.hypot(x,z),ox=x+x/d*85,oz=z+z/d*85,h=rawHeight(ox,oz);if(h>2&&h<12&&(!best||x>best.x))best={x:ox,z:oz,h};}
  if(best){const g=new THREE.Group(),red=new THREE.MeshStandardMaterial({color:0xc8322a,roughness:0.6}),white=new THREE.MeshStandardMaterial({color:0xf6f4ef,roughness:0.6});
    for(let k=0;k<6;k++){const r0=2.4-k*0.13,r1=2.4-(k+1)*0.13,m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,3.2,20),k%2?red:white);m.position.y=1.6+k*3.2;g.add(m);}
    const gal=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,0.4,20),new THREE.MeshStandardMaterial({color:0x333333}));gal.position.y=19.4;g.add(gal);
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2,16),new THREE.MeshStandardMaterial({color:0xfff2b0,emissive:0xffd25a,emissiveIntensity:0.9}));lamp.position.y=20.7;g.add(lamp);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.5,1.8,16),red);roof.position.y=22.7;g.add(roof);
    const base=new THREE.Mesh(new THREE.BoxGeometry(6,3,5),white);base.position.set(3,1.5,0);g.add(base);
    g.position.set(best.x,best.h-0.5,best.z);g.traverse(o=>{o.castShadow=true;});scene.add(g);}
  // Boote
  for(let k=0;k<7;k++){let x,z,tries=0;do{const a=rnd(0,6.28),r=rnd(2950,3500);x=Math.cos(a)*r;z=Math.sin(a)*r;tries++;}while(rawHeight(x,z)>-6&&tries<30);
    const b=new THREE.Group(),hull=new THREE.Mesh(new THREE.CylinderGeometry(1.4,0.8,7,10,1,false,0,Math.PI),new THREE.MeshStandardMaterial({color:k%2?0xffffff:0x1d4e8a,roughness:0.5,side:THREE.DoubleSide}));
    hull.rotation.set(Math.PI/2,0,Math.PI);hull.scale.set(1,1,0.6);b.add(hull);
    const cab=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,2.2),new THREE.MeshStandardMaterial({color:0xf2efe8}));cab.position.set(0,0.6,-0.6);b.add(cab);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,6,5),new THREE.MeshStandardMaterial({color:0xdddddd}));mast.position.set(0,3,0.8);b.add(mast);
    if(k%2===0){const sail=new THREE.Mesh(new THREE.PlaneGeometry(2.6,4.6),new THREE.MeshStandardMaterial({color:0xfdfcf6,side:THREE.DoubleSide}));sail.position.set(0,3.4,2.1);sail.rotation.y=Math.PI/2;b.add(sail);}
    b.position.set(x,0.3,z);b.rotation.y=rnd(0,6.28);b.userData.seed=rnd(0,10);scene.add(b);boats.push(b);}
  // Lavasee, Glühen, Rauch
  const ch=rawHeight(VOLC.x,VOLC.z);
  lavaMat=new THREE.MeshBasicMaterial({color:0xff5a1f});
  const lava=new THREE.Mesh(new THREE.CircleGeometry(68,32),lavaMat);lava.rotation.x=-Math.PI/2;lava.position.set(VOLC.x,ch+12,VOLC.z);scene.add(lava);
  lavaLight=new THREE.PointLight(0xff6a00,2.4,900,1.6);lavaLight.position.set(VOLC.x,ch+50,VOLC.z);scene.add(lavaLight);
  const st=softTex();
  for(let k=0;k<46;k++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:st,color:0x9a948f,transparent:true,depthWrite:false,opacity:0.5}));
    sp.userData={age:Math.random(),ox:rnd(-30,30),oz:rnd(-30,30),base:ch+15};scene.add(sp);smoke.push(sp);}
  makeArch(40,'START · ZIEL','#1f6fd1');
  climbArches();mapLabel('Vulkan Kalea',VOLC.x,VOLC.z,'key');{const r=roadAt(500);mapLabel('Fischerdorf',r.x,r.z,'lm');}if(best)mapLabel('Leuchtturm',best.x,best.z,'key');
}
function climbArches(){
  for(const c of CLIMBS){makeArch(c.start+4,'⛰ '+c.name.toUpperCase()+' · START','#e8a317');makeArch(Math.max(0,c.end-6),'BERGWERTUNG '+c.name.toUpperCase(),'#c62828');komDecor(Math.round(c.end/ds)%N);}}
let FANS=[];
function fanGeos(){return fanGeos.g||(fanGeos.g=personParts(true));}
function komDecor(KI,ok){
  // jubelnde Zuschauer & Fahnen an der Bergwertung
  const G=fanGeos(),cnt=64,vm=()=>new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.8,vertexColors:true}),shirtM=new THREE.InstancedMesh(G.shirt,vm(),cnt),skinM=new THREE.InstancedMesh(G.skin,vm(),cnt),legM=new THREE.InstancedMesh(G.legs,vm(),cnt);
  const dm=new THREE.Object3D(),col=new THREE.Color(),shirts=[0xd62f2f,0xf2c230,0x2e7dd7,0xffffff,0x2bb673,0xff7a1a,0x7a4fd6,0xff8fb8,0x3ec1d3],skins=[0xf1c9a5,0xe2b48d,0xc68e62,0x8d5a3b,0xf6d7bd],pants=[0x2a3a5a,0x3a3a3a,0x6b4b2e,0x1f5f8b];
  const base=[];
  for(let k=0;k<cnt;k++){const r=roadAt(KI*ds-75+Math.floor(k/2)*2.3),side=k%2?1:-1,off=side*rnd(6.3,8.2),x=r.x-r.tz*off,z=r.z+r.tx*off; // in Metern, nicht in Streckenpunkten
    const b={x,y:groundH(x,z)-0.05,z,ry:Math.atan2(r.tx,r.tz)+(side>0?-Math.PI/2:Math.PI/2)+rnd(-0.3,0.3),s:(ok&&!ok(x,z))||nearestRoad(x,z,5.6)?0:rnd(0.88,1.1),ph:rnd(0,6.28),sp:rnd(5,8)};base.push(b);
    dm.position.set(b.x,b.y,b.z);dm.rotation.set(0,b.ry,0);dm.scale.setScalar(b.s);dm.updateMatrix();
    for(const m of [shirtM,skinM,legM])m.setMatrixAt(k,dm.matrix);
    shirtM.setColorAt(k,col.set(shirts[k%shirts.length]));skinM.setColorAt(k,col.set(skins[(k*7)%skins.length]));legM.setColorAt(k,col.set(pants[(k*3)%pants.length]));}
  for(const m of [shirtM,skinM,legM]){m.castShadow=true;m.frustumCulled=false;scene.add(m);}
  FANS.push({ms:[shirtM,skinM,legM],base,cx:RX[KI],cz:RZ[KI]});
  const flagTex=canvasTex(64,64,(x)=>{for(let a=0;a<8;a++)for(let b=0;b<8;b++){x.fillStyle=(a+b)%2?'#c62828':'#ffffff';x.fillRect(a*8,b*8,8,8);}});
  for(let k=0;k<12;k++){const i=(KI-Math.round(110/ds)+k*Math.round(10/ds)+N)%N,side=k%2?1:-1,[x,z]=lateralPoint(i,side*5.6),h=groundH(x,z);if(nearestRoad(x,z,5.2))continue;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,4,5),new THREE.MeshStandardMaterial({color:0xcccccc}));pole.position.set(x,h+2,z);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.8),new THREE.MeshStandardMaterial({map:flagTex,side:THREE.DoubleSide}));fl.position.set(x+0.6,h+3.5,z);fl.rotation.y=Math.atan2(RTX[i],RTZ[i])+Math.PI/2;
    scene.add(pole,fl);}
}

/* ================= WELT ULM ================= */
// Gelände: EU-DEM 25 m (über OpenTopoData), Straßen: OpenStreetMap (ODbL) über OSRM, aufbereitet für die App.
const UY0=460;                  // Höhe über NN, die y=0 entspricht
const WATER_Y=465.6-UY0;        // Donau-Wasserspiegel in Ulm (~465–466 m ü. NN)
const RIVER_HW=36;              // halbe Flussbreite
let ULM=null,RIV=null,RIVW=null,RIVG=null,VR=[],VRHASH=new Map();
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ulmLL(lon,lat){const o=ULM_DATA.origin,kx=111320*Math.cos(o[0]*Math.PI/180);return [(lon-o[1])*kx,-(lat-o[0])*110540];}
function ulmInit(){
  ULM=ULM_DATA;
  // Flüsse (Index 0 = Donau, dann Iller, Blau) aus OSM-Wasserflächen: Mittellinie, halbe Breite je Seite, Wasserspiegel
  ULM.river=ULM.rivers[0].p;RIV=[];
  RIVW=ULM.rivers.map(rv=>({p:rv.p.map(q=>q[2]),m:rv.p.map(q=>q[3]),y:rv.p.map(q=>q[4]-UY0),d:rv.p.map(q=>Math.max(q[2],q[3]))}));
  ULM.rivers.forEach((rv,ri)=>{const r=rv.p;for(let i=0;i<r.length-1;i++){const a=r[i],b=r[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;RIV.push({a,b,dx,dz,l2:dx*dx+dz*dz||1,tx:dx/l,tz:dz/l,i,ri});}});
  RIVG=new Map();for(const sg of RIV){const x0=Math.min(sg.a[0],sg.b[0])-400,x1=Math.max(sg.a[0],sg.b[0])+400,z0=Math.min(sg.a[1],sg.b[1])-400,z1=Math.max(sg.a[1],sg.b[1])+400;
    for(let i=Math.floor(x0/100);i<=Math.floor(x1/100);i++)for(let j=Math.floor(z0/100);j<=Math.floor(z1/100);j++){const k=i*100000+j;if(!RIVG.has(k))RIVG.set(k,[]);RIVG.get(k).push(sg);}}
  // Sichtstraßen: feste Nebenstraßen + die Straßen der anderen Routen (ohne Stücke, die auf der gefahrenen Strecke liegen)
  const VL=[],seen=new Set(),ck=(x,z)=>Math.floor(x/9)+'|'+Math.floor(z/9);
  const mark=(x,z)=>{const ix=Math.floor(x/9),iz=Math.floor(z/9);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)seen.add((ix+a)+'|'+(iz+b));};
  const addLine=(pts,name,w)=>{let cur=[];const flush=()=>{if(cur.length>1)VL.push({n:name,p:cur,w});cur=[];};
    for(const q of pts){if(nearestRoad(q[0],q[1],12)||seen.has(ck(q[0],q[1]))){if(cur.length)cur.push(q);flush();continue;}cur.push(q);}flush();
    for(const v of VL)if(v.n===name)for(const q of v.p)mark(q[0],q[1]);};
  for(const rd of ULM.roads){const dense=[];for(let i=0;i<rd.p.length-1;i++){const a=rd.p[i],b=rd.p[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8));for(let k=0;k<n;k++)dense.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
    dense.push(rd.p[rd.p.length-1]);addLine(dense,rd.n,rd.n.startsWith('B 10')?7:3.8);}
  for(const rt of ULM.routes){if(rt===ROUTE)continue;let si=0,cur=[],nm=null;
    for(let i=0;i<rt.x.length;i+=2){while(si<rt.segs.length-1&&rt.segs[si+1][0]<=i)si++;const n=rt.segs[si][1];
      if(n!==nm&&cur.length){cur.push([rt.x[i],rt.z[i]]);addLine(cur,nm,4);cur=[];}nm=n;cur.push([rt.x[i],rt.z[i]]);}
    if(cur.length)addLine(cur,nm,4);}
  ULM.vroads=VL;
  for(const rd of VL){const p=rd.p;for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    const sg={a,b,dx,dz,l2:dx*dx+dz*dz,tx:dx/l,tz:dz/l,name:rd.n,w:rd.w};VR.push(sg);
    const n=Math.ceil(l/20);for(let k=0;k<=n;k++){const x=a[0]+dx*k/n,z=a[1]+dz*k/n,key=hkey(Math.floor(x/CELL),Math.floor(z/CELL));if(!VRHASH.has(key))VRHASH.set(key,new Set());VRHASH.get(key).add(sg);}}}
}
function segDist(s,x,z){const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/s.l2,0,1);return Math.hypot(x-s.a[0]-s.dx*t,z-s.a[1]-s.dz*t);}
// Abstand zum Fluss. d ist auf die Standardbreite umgerechnet (d − echte halbe Breite + RIVER_HW), so dass alle
// Vergleiche mit RIVER_HW auch dort stimmen, wo der Fluss schmaler gemacht wurde (riverFit)
function riverDist(x,z){let best=1e9,bs=null,bt=0;const L=RIVG&&RIVG.get(Math.floor(x/100)*100000+Math.floor(z/100));if(RIVG&&!L)return {d:1e4,s:null,wy:WATER_Y};for(const s of L||RIV){const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/s.l2,0,1),d=Math.hypot(x-s.a[0]-s.dx*t,z-s.a[1]-s.dz*t);if(d<best){best=d;bs=s;bt=t;}}
  if(!bs)return {d:1e4,s:null,wy:WATER_Y};const side=(bs.tx*(z-bs.a[1])-bs.tz*(x-bs.a[0]))>=0?1:-1,R=RIVW[bs.ri],W=side>0?R.p:R.m,hw=W[bs.i]+(W[bs.i+1]-W[bs.i])*bt;
  return {d:best+RIVER_HW-hw,raw:best,s:bs,side,hw,wy:R.y[bs.i]+(R.y[bs.i+1]-R.y[bs.i])*bt};}
// Fluss an die echten Häuser und Wege anpassen: wo die (grob vermessene) Flusslinie Häuser oder Uferwege überdecken
// würde, wird er auf dieser Seite schmaler (mind. 14 m halbe Breite). Brücken (Straße quert die Mitte) zählen nicht.
function riverFit(){
  const G=new Map(),cell=12,key=(x,z)=>Math.floor(x/cell)+'|'+Math.floor(z/cell);
  if(OSM.data)for(const b of OSM.data.b){const P=b.p;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<P.length;i+=2){x0=Math.min(x0,P[i]);x1=Math.max(x1,P[i]);z0=Math.min(z0,P[i+1]);z1=Math.max(z1,P[i+1]);}
    if(x1-x0>400||z1-z0>400)continue;for(let i=Math.floor((x0-3)/cell);i<=Math.floor((x1+3)/cell);i++)for(let j=Math.floor((z0-3)/cell);j<=Math.floor((z1+3)/cell);j++){const k=i+'|'+j;if(!G.has(k))G.set(k,[]);G.get(k).push(P);}}
  const inB=(x,z)=>{for(const P of G.get(key(x,z))||[]){let c=false;for(let i=0,j=P.length-2;i<P.length;j=i,i+=2){const ax=P[i],az=P[i+1],bx=P[j],bz=P[j+1];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)c=!c;}if(c)return true;}return false;};
  ULM.rivers.forEach((rv,ri)=>{const r=rv.p,n=r.length,R=RIVW[ri],HP=R.p.slice(),HM=R.m.slice();
  for(let i=0;i<n;i++){const a=r[Math.max(0,i-1)],b=r[Math.min(n-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    let cross=false;for(let u=-60;u<=60&&!cross;u+=6){const qx=r[i][0]+tx*u,qz=r[i][1]+tz*u;if(nearestRoad(qx,qz,16)||nearVRoad(qx,qz,12))cross=true;}
    for(const sd of [1,-1]){const W0=(sd>0?R.p:R.m)[i];for(let t=Math.min(4,W0);t<=W0+4;t+=2){const x=r[i][0]-tz*sd*t,z=r[i][1]+tx*sd*t;
      let hit=inB(x,z)||inB(x+2.5,z)||inB(x-2.5,z)||inB(x,z+2.5)||inB(x,z-2.5);
      if(!hit&&!cross){const vr=nearVRoad(x,z,9);hit=!!nearestRoad(x,z,6.5)||!!(vr&&vr.d<(vr.s.w||4)+1.5);}
      if(hit){(sd>0?HP:HM)[i]=Math.max(Math.min(14,W0),Math.min(W0,t-3));break;}}}}
  // glätten: erst Minimum der Nachbarn, dann Mittel – keine Zacken im Ufer
  const sm=A=>{const m=A.map((v,i)=>Math.min(v,A[Math.max(0,i-1)],A[Math.min(n-1,i+1)]));return m.map((v,i)=>Math.min(v,(m[Math.max(0,i-1)]+2*v+m[Math.min(n-1,i+1)])/4+2));};
  R.p=sm(HP);R.m=sm(HM);});}
function nearVRoad(x,z,maxR){const ix=Math.floor(x/CELL),iz=Math.floor(z/CELL),rr=Math.ceil(maxR/CELL);let best=maxR,bs=null;
  for(let dx=-rr;dx<=rr;dx++)for(let dz=-rr;dz<=rr;dz++){const set=VRHASH.get(hkey(ix+dx,iz+dz));if(!set)continue;for(const s of set){const d=segDist(s,x,z);if(d<best){best=d;bs=s;}}}
  return bs?{d:best,s:bs}:null;}
function ulmDem(x,z){const g=ULM.grid;let gx=(x-g.x0)/g.dx,gz=(z-g.z0)/g.dz;
  const out=Math.max(0,-gx,gx-(g.nx-1),-gz,gz-(g.nz-1));gx=clamp(gx,0,g.nx-1.001);gz=clamp(gz,0,g.nz-1.001);
  const i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j,H=g.h;
  // bikubisch-ähnlich weich: Catmull-Rom in beide Richtungen
  const cr=(p0,p1,p2,p3,t)=>0.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);
  const row=jj=>{const r=H[clamp(jj,0,g.nz-1)];const q=k=>r[clamp(k,0,g.nx-1)];return cr(q(i-1),q(i),q(i+1),q(i+2),fx);};
  let h=cr(row(j-1),row(j),row(j+1),row(j+2),fz);
  if(out>0){const t=sstep(out/18);h=h+(476-h)*t*0.8+Math.sin(x*0.0011)*Math.cos(z*0.0013)*25*t;}
  return h;}
function ulmHeight(x,z){let h=ulmDem(x,z)-UY0;
  const R=riverDist(x,z),rd=R.d;if(rd<RIVER_HW+40){const bed=R.wy-2.5,t=sstep((rd-RIVER_HW+4)/40);h=bed+(Math.max(h,R.wy+1.2)-bed)*t;}
  return h;}
// Stadtviertel (Bebauungsdichte und Charakter)
const ULM_ZONES=[
  // typ, lon, lat, rx, rz, dichte
  ['alt',9.9925,48.3978,650,330,1.0],['city',9.9975,48.4030,460,330,0.9],['city',10.0015,48.3990,320,260,0.85],
  ['city',9.9880,48.4035,650,300,0.95],['city',9.9740,48.3975,700,450,0.9],['city',10.0080,48.4030,450,350,0.85],['city',9.9990,48.3900,800,420,0.85],['city',9.9850,48.3925,260,200,0.8],
  ['sub',9.9530,48.3975,650,450,0.75],['sub',9.9650,48.4140,900,480,0.65],['sub',9.9450,48.4110,500,400,0.5],['sub',9.9640,48.3995,500,400,0.7],['sub',9.9640,48.3880,600,350,0.65],['sub',9.9900,48.4090,450,250,0.65],['sub',10.0090,48.4120,500,350,0.65],
  ['sub',10.0230,48.4210,650,450,0.6],['city',10.0012,48.3952,560,250,0.9],['sub',10.0100,48.3820,800,500,0.65],['sub',9.9900,48.3790,650,400,0.6],['sub',9.9700,48.4060,420,220,0.55],['sub',10.0330,48.3930,500,450,0.5],
  ['ind',9.9520,48.3735,950,330,0.8],['ind',10.0260,48.3990,420,260,0.7],
];
const ULM_NOBUILD=[ // Parks, Wälder, Freiflächen: lon, lat, Radius
  [10.0165,48.4045,520],[9.9955,48.3912,200],[9.9975,48.4043,95],[9.9826,48.4122,210],[9.9524,48.3847,230],[10.0022,48.4176,160],
  [9.9370,48.3830,700],[9.9350,48.4205,450],[9.9600,48.4300,380],[10.0120,48.4220,260],[9.9640,48.4235,330],[9.9560,48.4232,330],[9.9880,48.4105,160]];
let ZONEXY=null,NOBXY=null;
let ZONEG=null;
function ulmZone(x,z){if(!ZONEXY){ZONEXY=ULM_ZONES.concat(ULM_DATA.zones||[]).map(([t,lo,la,rx,rz,d,n])=>{const p=ulmLL(lo,la);return {t,x:p[0],z:p[1],rx,rz,d,n};});NOBXY=ULM_NOBUILD.map(([lo,la,r])=>{const p=ulmLL(lo,la);return {x:p[0],z:p[1],r};});
    // Raster (500 m): welche Zonen kommen hier überhaupt in Frage
    ZONEG=new Map();for(const zn of ZONEXY){for(let i=Math.floor((zn.x-zn.rx*1.15)/500);i<=Math.floor((zn.x+zn.rx*1.15)/500);i++)for(let j=Math.floor((zn.z-zn.rz*1.15)/500);j<=Math.floor((zn.z+zn.rz*1.15)/500);j++){const k=i*10000+j;if(!ZONEG.has(k))ZONEG.set(k,[]);ZONEG.get(k).push(zn);}}}
  const L=ZONEG.get(Math.floor(x/500)*10000+Math.floor(z/500));if(!L)return {t:null,d:0};
  let best=null,bv=0;for(const zn of L){const e=Math.hypot((x-zn.x)/zn.rx,(z-zn.z)/zn.rz);const v=zn.d*(1-sstep((e-0.75)/0.35));if(v>bv){bv=v;best=zn;}}
  for(const nb of NOBXY){const d=Math.hypot(x-nb.x,z-nb.z);if(d<nb.r)bv*=sstep((d-nb.r*0.75)/(nb.r*0.25));}
  return {t:best?best.t:null,d:bv};}
// Kern = Gebiet des ursprünglichen Höhenrasters (Innenstadt mit allen Wahrzeichen); dazu kommt die Umgebung der Route
const ULM_CORE={x0:-4619,x1:4250,z0:-3703,z1:2664};
function buildRouteUlm(){
  ULM=ULM_DATA;ROUTE=ULM.routes.find(r=>r.id===ROUTE_ID)||ULM.routes[0];
  {let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<ROUTE.x.length;i++){x0=Math.min(x0,ROUTE.x[i]);x1=Math.max(x1,ROUTE.x[i]);z0=Math.min(z0,ROUTE.z[i]);z1=Math.max(z1,ROUTE.z[i]);}
    const C=ULM_CORE;ULM.area={x0:Math.min(C.x0-2600,x0-2500),x1:Math.max(C.x1+2600,x1+2500),z0:Math.min(C.z0-2600,z0-2500),z1:Math.max(C.z1+2600,z1+2500)};}
  const R=ROUTE,n0=R.x.length,cum=[0];for(let i=1;i<n0;i++)cum.push(cum[i-1]+Math.hypot(R.x[i]-R.x[i-1],R.z[i]-R.z[i-1]));
  // geschlossene Runde: letztes Stück zurück zum Start
  const close=Math.hypot(R.x[0]-R.x[n0-1],R.z[0]-R.z[n0-1]);L=cum[n0-1]+close;N=Math.round(L/4);ds=L/N;
  RX=new Float32Array(N);RZ=new Float32Array(N);RH=new Float32Array(N);RNAME=new Array(N);
  let j=0;const segs=R.segs;let si=0;
  for(let i=0;i<N;i++){const d=i*ds;while(j<n0-2&&cum[j+1]<d)j++;
    let x,z,h;if(d<=cum[n0-1]){const t=(d-cum[j])/(cum[j+1]-cum[j]||1);x=R.x[j]+(R.x[j+1]-R.x[j])*t;z=R.z[j]+(R.z[j+1]-R.z[j])*t;h=R.h[j]+(R.h[j+1]-R.h[j])*t;}
    else{const t=(d-cum[n0-1])/close;x=R.x[n0-1]+(R.x[0]-R.x[n0-1])*t;z=R.z[n0-1]+(R.z[0]-R.z[n0-1])*t;h=R.h[n0-1]+(R.h[0]-R.h[n0-1])*t;}
    RX[i]=x;RZ[i]=z;RH[i]=h-UY0;while(si<segs.length-1&&segs[si+1][0]<=j)si++;RNAME[i]=segs[si][1];}
  RG=new Float32Array(N);RTX=new Float32Array(N);RTZ=new Float32Array(N);LAPCLIMB=0;MAXH=0;
  for(let i=0;i<N;i++){const a=(i-2+N)%N,b=(i+2)%N;RG[i]=(RH[b]-RH[a])/(4*ds);const tx=RX[b]-RX[a],tz=RZ[b]-RZ[a],l=Math.hypot(tx,tz)||1;RTX[i]=tx/l;RTZ[i]=tz/l;
    const dh=RH[(i+1)%N]-RH[i];if(dh>0)LAPCLIMB+=dh;if(RH[i]>MAXH){MAXH=RH[i];KOM_I=i;}
    const key=hkey(Math.floor(RX[i]/CELL),Math.floor(RZ[i]/CELL));if(!HASH.has(key))HASH.set(key,[]);HASH.get(key).push(i);}
  RG=smoothCirc(RG,3);
  ulmInit();CLIMBS=(ROUTE.climbs||[]).map(c=>({...c,key:'ulm_'+c.name}));
}
let RNAME=null;
/* ---- Gelände ---- */
function buildTerrainUlm(){
  const A=ULM.area,x0=A.x0,x1=A.x1,z0=A.z0,z1=A.z1;
  const W=x1-x0,H=z1-z0,res=S.quality==='high'?24:S.quality==='medium'?34:48,SX=Math.round(W/res),SZ=Math.round(H/res),dx=W/SX,dz=H/SZ;
  // Entlang der Strecke feineres Netz (6–8 m statt 24–48 m), sonst schneiden grobe Dreiecke in Kehren und Hanglagen
  // über die Fahrbahn. Kanten zu groben Nachbarzellen werden linear gehalten, damit keine Risse entstehen.
  const fr=S.quality==='low'?8:6,sub=Math.max(2,Math.round(Math.max(dx,dz)/fr)),fine=new Uint8Array(SX*SZ),FINE=new Map();
  for(let j=0;j<SZ;j++)for(let i=0;i<SX;i++){if(nearestRoad(x0+(i+0.5)*dx,z0+(j+0.5)*dz,Math.hypot(dx,dz)*0.5+16))fine[j*SX+i]=1;}
  const isFine=(i,j)=>i>=0&&j>=0&&i<SX&&j<SZ&&fine[j*SX+i]===1;
  const hAt=(x,z)=>{const nr=nearestRoad(x,z,70),rd=riverDist(x,z).d;
    // unter den Brücken kein Damm: dort bleibt das Flussbett frei
    const uh=ulmHeight(x,z),bh=blendRoad(uh,nr),rw=sstep((rd-RIVER_HW-2)/22);let h=uh+(bh-uh)*rw;
    // unter der Fahrbahn eine flache Mulde, daneben höchstens 35 % Anstieg – gemessen an allen nahen Streckenpunkten
    // (in Kehren liegt der untere Ast sonst unter dem Hang des oberen); die Straße hat seitliche Blenden (buildRoad)
    if(nr&&nr.d<30){const ix=Math.floor(x/CELL),iz=Math.floor(z/CELL);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const arr=HASH.get(hkey(ix+a,iz+b));if(!arr)continue;
      for(const k of arr){const d=Math.hypot(RX[k]-x,RZ[k]-z);if(d<30)h=Math.min(h,RH[k]-1.25+0.35*Math.max(0,d-4)+sstep((d-22)/8)*50);}}}
    return h;};
  const P=[],UV=[],IDX=[];let nv=0;
  const vtx=(x,z,h)=>{P.push(x,h,z);UV.push((x-x0)/W,(z-z0)/H);return nv++;};
  const CY=new Float32Array((SX+1)*(SZ+1));for(let j=0;j<=SZ;j++)for(let i=0;i<=SX;i++){const x=x0+i*dx,z=z0+j*dz;CY[j*(SX+1)+i]=hAt(x,z);vtx(x,z,CY[j*(SX+1)+i]);}
  const C=(i,j)=>j*(SX+1)+i;
  for(let j=0;j<SZ;j++)for(let i=0;i<SX;i++){
    if(!fine[j*SX+i]){const a=C(i,j),b=C(i,j+1),c=C(i+1,j+1),d=C(i+1,j);IDX.push(a,b,d,b,c,d);continue;}
    const n=sub,Y=new Float32Array((n+1)*(n+1)),base=nv,ca=CY[C(i,j)],cb=CY[C(i,j+1)],cc=CY[C(i+1,j+1)],cd=CY[C(i+1,j)];
    for(let v=0;v<=n;v++)for(let u=0;u<=n;u++){const x=x0+(i+u/n)*dx,z=z0+(j+v/n)*dz,fu=u/n,fv=v/n;let h;
      // Rand zu einer groben Zelle: genau wie deren Kante (linear zwischen den Ecken)
      if(u===0&&!isFine(i-1,j))h=ca+(cb-ca)*fv;else if(u===n&&!isFine(i+1,j))h=cd+(cc-cd)*fv;
      else if(v===0&&!isFine(i,j-1))h=ca+(cd-ca)*fu;else if(v===n&&!isFine(i,j+1))h=cb+(cc-cb)*fu;
      else if((u===0||u===n)&&(v===0||v===n))h=CY[C(i+u/n,j+v/n)];else h=hAt(x,z);
      Y[v*(n+1)+u]=h;vtx(x,z,h);}
    for(let v=0;v<n;v++)for(let u=0;u<n;u++){const a=base+v*(n+1)+u,b=a+(n+1),c=b+1,d=a+1;IDX.push(a,b,d,b,c,d);}
    FINE.set(j*SX+i,Y);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
  geo.setIndex(nv>65535?new THREE.Uint32BufferAttribute(IDX,1):new THREE.Uint16BufferAttribute(IDX,1));
  TERR={x0,z0,dx,dz,nx:SX+1,nz:SZ+1,Y:CY,sub,FINE,SX};
  geo.computeVertexNormals();
  const pos=geo.attributes.position,near=new Float32Array(pos.count),vnear=new Float32Array(pos.count),rdist=new Float32Array(pos.count);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),nr=nearestRoad(x,z,70);near[i]=nr?nr.d:99;rdist[i]=riverDist(x,z).d;const vr=nearVRoad(x,z,30);vnear[i]=vr?vr.d:99;}
  const nor=geo.attributes.normal,cols=new Float32Array(pos.count*3),c=new THREE.Color(),t=new THREE.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=pos.getY(i),ny=nor.getY(i),p=patch(x,z),zn=ulmZone(x,z);
    // Feldermuster außerhalb der Stadt
    const fx=Math.floor((x*0.8+z*0.35)/170),fz=Math.floor((z*0.8-x*0.35)/120),fr=mulberry32(fx*7919+fz*104729)();
    const fields=[[0.42,0.56,0.25],[0.55,0.60,0.30],[0.62,0.58,0.36],[0.47,0.62,0.28],[0.66,0.55,0.33],[0.38,0.52,0.22]];
    const f=fields[Math.floor(fr*fields.length)];c.setRGB(f[0]+p*0.03,f[1]+p*0.03,f[2]);
    t.setRGB(0.34+p*0.05,0.52+p*0.06,0.24);c.lerp(t,0.55); // Wiesen
    // Stadt: versiegelter Boden
    const u=zn.d;t.setRGB(0.52,0.50,0.47);c.lerp(t,sstep(u*1.3)*0.85);
    if(zn.t==='sub')c.lerp(t.setRGB(0.42,0.52,0.32),0.35*u);
    // Steilhänge dunkler (Wald)
    c.lerp(t.setRGB(0.22,0.36,0.17),sstep((0.93-ny)/0.08)*0.7);
    // Ufer
    if(rdist[i]<RIVER_HW+30)c.lerp(t.setRGB(0.40,0.50,0.30),1-sstep((rdist[i]-RIVER_HW)/30));
    if(near[i]<11)c.lerp(t.setRGB(0.50,0.48,0.44),0.7*(1-sstep((near[i]-7)/4)));
    if(vnear[i]<9)c.lerp(t.setRGB(0.36,0.37,0.39),0.9*(1-sstep((vnear[i]-5.5)/3.5)));
    cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b;}
  geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
  const detail=grassDetailTex();detail.repeat.set(W/7,H/7);
  const mesh=new THREE.Mesh(geo,detailBlend(new THREE.MeshStandardMaterial({vertexColors:true,map:detail,roughness:1})));mesh.receiveShadow=true;scene.add(mesh);
  // äußerer Boden bis zum Horizont
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000),new THREE.MeshStandardMaterial({color:0x6f8a52,roughness:1}));outer.rotation.x=-Math.PI/2;outer.position.y=WATER_Y-6.5;scene.add(outer);
}
/* ---- Donau ---- */
function buildRiverUlm(){
  const P=[],E=[],I=[];
  ULM.rivers.forEach((rv,ri)=>{const r=rv.p,R=RIVW[ri],o=P.length/3;
    for(let i=0;i<r.length;i++){const a=r[Math.max(0,i-1)],b=r[Math.min(r.length-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
      for(const s of [-1,-0.5,0,0.5,1]){const w=(s>0?R.p[i]:R.m[i])+Math.min(2,R.p[i]*0.3);P.push(r[i][0]-tz*s*w,R.y[i],r[i][1]+tx*s*w);E.push(Math.abs(s));}
      if(i<r.length-1)for(let k=0;k<4;k++){const q=o+i*5+k;I.push(q,q+5,q+1,q+1,q+5,q+6);}}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('edge',new THREE.Float32BufferAttribute(E,1));g.setIndex(I);
  const m=new THREE.ShaderMaterial({fog:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},sunDir:{value:SUN_DIR},deep:{value:new THREE.Color(0x3b6a6a)},shallow:{value:new THREE.Color(0x5f8f7f)},skyCol:{value:new THREE.Color(0xa7cfec)},fogColor:{value:HORIZON},fogDensity:{value:FOG_DENS}},
    vertexShader:'attribute float edge;varying float vE;varying vec3 wp;void main(){vE=edge;vec4 w=modelMatrix*vec4(position,1.0);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float time,fogDensity;uniform vec3 sunDir,deep,shallow,skyCol,fogColor;varying vec3 wp;varying float vE;
      float H(vec2 p){float t=time;return sin(dot(p,vec2(0.09,0.03))+t*1.3)*0.25+sin(dot(p,vec2(-0.05,0.11))+t*1.7)*0.18+sin(dot(p,vec2(0.27,0.19))+t*2.6)*0.07+sin(dot(p,vec2(-0.6,0.45))+t*3.9)*0.03;}
      void main(){vec2 p=wp.xz+vec2(time*0.9,time*0.5);float dist=length(cameraPosition-wp),e=0.5,fade=1.0-smoothstep(200.0,2500.0,dist);
        vec2 gr=vec2(H(p+vec2(e,0.0))-H(p-vec2(e,0.0)),H(p+vec2(0.0,e))-H(p-vec2(0.0,e)))/(2.0*e);
        vec3 n=normalize(vec3(-gr.x*fade*1.4,1.0,-gr.y*fade*1.4));vec3 v=normalize(cameraPosition-wp);
        float fres=pow(1.0-max(dot(n,v),0.0),4.0);vec3 wc=mix(deep,shallow,smoothstep(0.55,1.0,vE));
        vec3 col=mix(wc,skyCol,0.12+fres*0.7);vec3 r=reflect(-v,n);col+=vec3(1.0,0.95,0.85)*pow(max(dot(r,sunDir),0.0),200.0)*1.3;
        col=mix(col,vec3(0.9,0.93,0.92),smoothstep(0.86,1.0,vE)*0.35);
        float f=1.0-exp(-pow(fogDensity*dist,2.0));col=mix(col,fogColor,f);gl_FragColor=vec4(col,1.0);}`});
  water=new THREE.Mesh(g,m);water.renderOrder=1;scene.add(water);
}
/* ---- Gebäude-Bausteine ---- */
function facadeTex(kind){return canvasTex(256,256,(x,w,h)=>{
  x.fillStyle='#f4f1ea';x.fillRect(0,0,w,h);x.fillStyle='#9a9a9a';x.fillRect(0,0,24,24); // Ecke: Dachfläche
  if(kind==='ind'){x.fillStyle='#d9d9d6';x.fillRect(0,0,w,h);x.fillStyle='#9a9a9a';x.fillRect(0,0,24,24);
    for(let i=0;i<w;i+=8){x.fillStyle=i%16?'#cfcfcb':'#e6e6e2';x.fillRect(i,40,6,h-40);}x.fillStyle='#5d6c7a';for(let i=20;i<w-30;i+=60)x.fillRect(i,150,40,60);return;}
  const win=(wx,wy,ww,wh,frame,shut)=>{x.fillStyle=frame;x.fillRect(wx-3,wy-3,ww+6,wh+6);const g=x.createLinearGradient(0,wy,0,wy+wh);g.addColorStop(0,'#3d4f61');g.addColorStop(1,'#7690a6');x.fillStyle=g;x.fillRect(wx,wy,ww,wh);
    x.fillStyle='rgba(255,255,255,.35)';x.fillRect(wx+ww/2-1,wy,2,wh);x.fillRect(wx,wy+wh*0.38,ww,2);if(shut){x.fillStyle=shut;x.fillRect(wx-8,wy,6,wh);x.fillRect(wx+ww+2,wy,6,wh);}};
  if(kind==='fach'){ // Fachwerk (Fischerviertel)
    x.fillStyle='#f6eedd';x.fillRect(0,30,w,h-30);x.strokeStyle='#6a4326';x.lineWidth=6;const fl=3,fh=(h-30)/fl;
    for(let f=0;f<=fl;f++){x.beginPath();x.moveTo(0,30+f*fh);x.lineTo(w,30+f*fh);x.stroke();}
    for(let k=0;k<=4;k++){x.beginPath();x.moveTo(k*w/4,30);x.lineTo(k*w/4,h);x.stroke();}
    for(let f=0;f<fl-1;f++)for(let k=0;k<4;k++){x.beginPath();if((f+k)%2){x.moveTo(k*w/4,30+f*fh);x.lineTo((k+1)*w/4,30+(f+1)*fh);}else{x.moveTo((k+1)*w/4,30+f*fh);x.lineTo(k*w/4,30+(f+1)*fh);}x.stroke();}
    for(let f=0;f<fl-1;f++)for(let k=0;k<4;k++)if((f+k)%3!==1)win(k*w/4+18,30+f*fh+16,w/4-36,fh-34,'#efe6d2','');
    x.fillStyle='#7a4a2a';x.fillRect(w*0.4,h-fh*0.85,w*0.2,fh*0.85);return;}
  if(kind==='shop'){ // Wohn- und Geschäftshaus: Schaufenster und Markisen im Erdgeschoss
    const fl=4,fh=(h-30)/fl,cols=4,cw=w/cols;
    for(let f=0;f<fl-1;f++)for(let k=0;k<cols;k++)win(k*cw+cw*0.26,30+f*fh+fh*0.2,cw*0.48,fh*0.55,'#e9e2d2','');
    const gy=30+(fl-1)*fh;x.fillStyle='#4a4f57';x.fillRect(0,gy,w,fh);
    for(let k=0;k<3;k++){const g=x.createLinearGradient(0,gy,0,h);g.addColorStop(0,'#9fc3d6');g.addColorStop(1,'#56778b');x.fillStyle=g;x.fillRect(8+k*w/3,gy+fh*0.3,w/3-16,fh*0.65);}
    const aw=['#d94a3a','#2f8f5b','#2e6fb3','#e0a020'][Math.floor(Math.random()*4)];for(let k=0;k<12;k++){x.fillStyle=k%2?aw:'#f6f1e6';x.fillRect(k*w/12,gy+2,w/12,fh*0.22);}
    x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,gy+fh*0.22,w,3);return;}
  const fl=kind==='alt'?4:kind==='sub'?3:6,cols=kind==='alt'?4:kind==='sub'?3:6,fh=(h-30)/fl,cw=w/cols;
  for(let f=0;f<fl;f++)for(let k=0;k<cols;k++){const wx=k*cw+cw*0.28,wy=30+f*fh+fh*0.22,ww=cw*0.44,wh=fh*(kind==='city'?0.55:0.5);
    if(kind==='alt'&&f===fl-1){x.fillStyle='#6b5a46';x.fillRect(k*cw+cw*0.15,30+f*fh+fh*0.15,cw*0.7,fh*0.75);continue;}
    win(wx,wy,ww,wh,kind==='alt'?'#e9e2d2':'#d7d7d7',kind==='alt'?'#4b6b4b':kind==='sub'&&k%2?'#8a5a3a':'');}
  if(kind==='city'){x.fillStyle='rgba(0,0,0,.08)';for(let f=1;f<fl;f++)x.fillRect(0,30+f*fh-2,w,3);}
  if(kind!=='sub'){x.fillStyle='rgba(0,0,0,.12)';x.fillRect(0,h-fh*0.35,w,fh*0.35);}
},false);}
function facadeBox(){const g=new THREE.BoxGeometry(1,1,1);g.translate(0,0.5,0);const uv=g.attributes.uv;
  for(let i=8;i<16;i++)uv.setXY(i,0.04,0.96);return g;}
function gableGeo(){const g=new THREE.BufferGeometry();
  const v=[-.5,0,-.5, .5,0,-.5, 0,1,-.5,  .5,0,.5, -.5,0,.5, 0,1,.5,
    -.5,0,-.5, 0,1,-.5, 0,1,.5, -.5,0,-.5, 0,1,.5, -.5,0,.5,   .5,0,-.5, .5,0,.5, 0,1,.5, .5,0,-.5, 0,1,.5, 0,1,-.5];
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();
  const uv=[];for(let i=0;i<v.length/3;i++){const x=v[i*3],y=v[i*3+1],z=v[i*3+2];if(i<6)uv.push(0.042,0.978);else uv.push((z+0.5)*12,y*10+Math.abs(x)*0.01);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;}
// Instanzen in Kacheln (wie die Vegetation), damit nur Sichtbares gezeichnet wird
function chunkedInstances(geo,mat,items,opts={}){const buckets=new Map(),out=[];
  for(const it of items){const k=Math.floor(it.x/CHUNK)+'|'+Math.floor(it.z/CHUNK);if(!buckets.has(k))buckets.set(k,{cx:(Math.floor(it.x/CHUNK)+0.5)*CHUNK,cz:(Math.floor(it.z/CHUNK)+0.5)*CHUNK,a:[]});buckets.get(k).a.push(it);}
  const dm=new THREE.Object3D(),col=new THREE.Color();
  for(const b of buckets.values()){let y0=1e9,y1=-1e9;for(const it of b.a){y0=Math.min(y0,it.y);y1=Math.max(y1,it.y+it.sy);}
    const m=new THREE.InstancedMesh(shareGeo(geo,(y0+y1)/2,CHUNK*0.75+(y1-y0)/2+30),mat,b.a.length);m.position.set(b.cx,0,b.cz);
    b.a.forEach((it,i)=>{dm.position.set(it.x-b.cx,it.y,it.z-b.cz);dm.rotation.set(it.rx||0,it.ry||0,0,'YXZ');dm.scale.set(it.sx,it.sy,it.sz);dm.updateMatrix();m.setMatrixAt(i,dm.matrix);col.set(it.c);m.setColorAt(i,col);});
    m.castShadow=opts.shadow!==false;m.receiveShadow=true;scene.add(m);CULLS.push(m);out.push(m);}return out;}
/* ---- Stadt ---- */
let LANDMARK_FOOT=[];
function footFree(x,z,pad){for(const f of LANDMARK_FOOT){if(Math.abs(x-f.x)<f.hx+pad&&Math.abs(z-f.z)<f.hz+pad)return false;}return true;}
function roadDir(x,z){const nr=nearestRoad(x,z,70),vr=nearVRoad(x,z,70);
  if(nr&&(!vr||nr.d<vr.d))return Math.atan2(RTX[nr.i],RTZ[nr.i]);if(vr)return Math.atan2(vr.s.tx,vr.s.tz);return null;}
const MAPBLD=[];
// Grundrisse mit Dachhöhe für die Kamera: steht ein Haus zwischen Kamera und Fahrer, rückt die Kamera näher heran
const CAMOCC=new Map(),CAMC=10;
function camOccAdd(P,top){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of P){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}
  if(x1-x0>300||z1-z0>300)return;const o={P,top};for(let i=Math.floor(x0/CAMC);i<=Math.floor(x1/CAMC);i++)for(let j=Math.floor(z0/CAMC);j<=Math.floor(z1/CAMC);j++){const k=i*100000+j;if(!CAMOCC.has(k))CAMOCC.set(k,[]);CAMOCC.get(k).push(o);}}
function camBlocked(x,z,y){const L=CAMOCC.get(Math.floor(x/CAMC)*100000+Math.floor(z/CAMC));if(!L)return false;
  for(const o of L){if(o.top<y)continue;const P=o.P;let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}if(c)return true;}return false;}
function rectPoly(cx,cz,ry,sx,sz){const c=Math.cos(ry),s=Math.sin(ry);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[cx+c*u*sx/2+s*v*sz/2,cz-s*u*sx/2+c*v*sz/2]);}
// Belegungsraster (2 m), damit Häuser sich nicht überlappen
const OCC=new Set(),OCCS=2;
function rectPts(cx,cz,ry,sx,sz,shrink,cb){const ax=Math.cos(ry),az=-Math.sin(ry),bx=Math.sin(ry),bz=Math.cos(ry),hx=sx/2-shrink,hz=sz/2-shrink;
  for(let u=-hx;u<=hx+0.01;u+=1.6)for(let v=-hz;v<=hz+0.01;v+=1.6){if(cb(cx+ax*u+bx*v,cz+az*u+bz*v)===false)return false;}return true;}
function occFree(cx,cz,ry,sx,sz){return rectPts(cx,cz,ry,sx,sz,0.6,(x,z)=>!OCC.has(Math.floor(x/OCCS)+'|'+Math.floor(z/OCCS)));}
function occMark(cx,cz,ry,sx,sz){rectPts(cx,cz,ry,sx,sz,0.2,(x,z)=>{OCC.add(Math.floor(x/OCCS)+'|'+Math.floor(z/OCCS));});}
function cornersClear(cx,cz,ry,sx,sz,clr){const ax=Math.cos(ry),az=-Math.sin(ry),bx=Math.sin(ry),bz=Math.cos(ry);
  for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0],[-1,0],[1,0],[0,-1],[0,1]]){const x=cx+ax*u*sx/2+bx*v*sz/2,z=cz+az*u*sx/2+bz*v*sz/2;
    if(nearestRoad(x,z,clr)||nearVRoad(x,z,clr-1.2)||riverDist(x,z).d<RIVER_HW+10||!footFree(x,z,2))return false;}return true;}
function buildCityUlm(){
  const rng=mulberry32(1234),R=(a,b)=>a+rng()*(b-a),pick=a=>a[Math.floor(rng()*a.length)];
  const kinds=['alt','city','sub','ind','shop','fach'],mats={};for(const k of kinds)mats[k]=new THREE.MeshStandardMaterial({map:facadeTex(k),roughness:0.88});
  const items={};for(const k of kinds)items[k]=[];const roofs=[];
  const wallCols={alt:[0xf3e9d2,0xefd9b8,0xe8d0c0,0xf6f0e1,0xd9e2d6,0xf2dcc8,0xe6e0cf,0xf4d9a8,0xd8e4ec,0xf1c9b5],city:[0xe9e4dc,0xd8d2c8,0xcfc8bd,0xe2dccf,0xf0ebe2,0xc9ccd0,0xdcd0bf,0xe8dcc4],
    sub:[0xf4efe4,0xece0cb,0xe2dccf,0xf6f2e8,0xe8dccb,0xf3e2c4],ind:[0xd9d9d6,0xc9ced3,0xe0ddd4,0xb9c2c9],shop:[0xf6efe2,0xf3e3c9,0xece4da,0xf6dcc8,0xe1ebe4,0xf4e6b8],fach:[0xf6eedd,0xf2e6cc,0xf4ece0]};
  const roofCols=[0x9c4a32,0x8a3b2a,0xa65a3c,0x7a4030,0x6e3a2e,0x4a4d52,0xb0583a];
  const P=ULM.places,fisch=[P.schiefeshaus[0]+30,P.schiefeshaus[1]+10];
  const add=(k,cx,cz,ry,sx,sz,h,roofType)=>{ // sx: quer zur Straße, sz: entlang der Straße
    if(OSM.data&&osmCovered(cx,cz))return;
    const y=Math.min(finalHeight(cx,cz),groundAt4(cx,cz,ry,sx,sz))-0.6;
    items[k].push({x:cx,z:cz,y,sx,sy:h+0.6,sz,ry,c:pick(wallCols[k])});camOccAdd(rectPoly(cx,cz,ry,sx,sz),y+h+0.6);MAPBLD.push([cx,cz,sx,sz,ry,k==='alt'||k==='fach'||k==='shop'?1:0]);occMark(cx,cz,ry,sx,sz);
    if(roofType==='giebel'){const rh=sz*R(0.6,0.85);roofs.push({x:cx,z:cz,y:y+h+0.6,sx:sz+0.7,sy:rh,sz:sx+0.6,ry:ry+Math.PI/2,c:pick(roofCols)});}
    else if(roofType==='trauf'){const rh=sx*R(0.4,0.6);roofs.push({x:cx,z:cz,y:y+h+0.6,sx:sx+0.7,sy:rh,sz:sz+0.6,ry,c:pick(roofCols)});}};
  const groundAt4=(cx,cz,ry,sx,sz)=>{let m=1e9;const ax=Math.cos(ry),az=-Math.sin(ry),bx=Math.sin(ry),bz=Math.cos(ry);for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1]])m=Math.min(m,finalHeight(cx+ax*u*sx*0.4+bx*v*sz*0.4,cz+az*u*sx*0.4+bz*v*sz*0.4));return m;};
  // 1) Häuserzeilen entlang der Straßen (wie in der echten Stadt: Fassaden zur Straße)
  const lines=[];{const pts=[];for(let i=0;i<N;i+=2)pts.push([RX[i],RZ[i]]);pts.push([RX[0],RZ[0]]);lines.push({p:pts,front:8.2,main:true});}
  for(const rd of ULM.vroads||[])lines.push({p:rd.p,front:(rd.w||5.5)+2.8,main:/Neue Straße|Olgastraße|Karlstraße|Frauenstraße|Hirschstraße|Bahnhofstraße|Augsburger|Wilhelm/.test(rd.n)});
  let rows=0;
  for(const ln of lines){const p=ln.p;
    for(const side of [-1,1]){let carry=R(0,6);
      for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],L2=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L2<0.5)continue;const tx=(b[0]-a[0])/L2,tz=(b[1]-a[1])/L2,ry=Math.atan2(tx,tz);
        let t=carry;while(t<L2){const mx=a[0]+tx*t,mz=a[1]+tz*t,zn=ulmZone(mx,mz);
          if(!zn.t||zn.d<0.3||zn.t==='ind'){t+=10;continue;}
          const inFisch=Math.hypot(mx-fisch[0],mz-fisch[1])<150;let k=zn.t==='alt'?(inFisch?'fach':(ln.main&&rng()<0.6?'shop':'alt')):zn.t==='city'?(ln.main&&rng()<0.5?'shop':'city'):'sub';
          let wAl,dep,h,gap,rt;
          if(k==='sub'){wAl=R(9,12);dep=R(9,11);h=R(5.5,8);gap=R(5,10);rt=rng()<0.5?'giebel':'trauf';}
          else if(zn.t==='alt'){wAl=R(8,13);dep=R(11,15);h=R(10,16);gap=R(0,0.6);rt=rng()<0.7?'giebel':'trauf';}
          else{wAl=R(14,24);dep=R(11,15);h=R(13,20);gap=R(0,2);rt=rng()<0.45?'trauf':'flat';}
          const off=ln.front+(k==='sub'?R(2,5):R(0,0.8))+dep/2,cx=mx+tx*wAl/2-tz*side*off,cz=mz+tz*wAl/2+tx*side*off;
          if(t+wAl<L2+3&&slopeY(cx,cz)>0.8&&cornersClear(cx,cz,ry,dep,wAl,6.3)&&occFree(cx,cz,ry,dep,wAl)){
            if(!(S.quality==='low'&&k==='sub'&&rng()<0.5)){add(k,cx,cz,ry+(rng()-0.5)*0.02,dep,wAl,h,rt);rows++;}t+=wAl+gap;}
          else t+=3;}
        carry=Math.max(0,t-L2);}}}
  // 2) Füllbebauung im Blockinneren
  const A=ULM.area,X0=A.x0+2600,X1=A.x1-2600,Z0=A.z0+2600,Z1=A.z1-2600;
  const spacing={alt:15,city:20,sub:24,ind:46};
  for(let x=X0;x<X1;x+=12)for(let z=Z0;z<Z1;z+=12){
    const zn=ulmZone(x,z);if(!zn.t||zn.d<0.08)continue;const sp=spacing[zn.t];
    if(((Math.floor(x/12)*7+Math.floor(z/12)*13)%Math.round(sp/12*sp/12))!==0&&zn.t!=='alt')continue;
    if(zn.t==='alt'&&((Math.floor(x/12)+Math.floor(z/12))%2))continue;
    if(rng()>zn.d*(zn.t==='sub'?0.75:0.95))continue;
    if(S.quality==='low'&&zn.t!=='alt'&&rng()<0.4)continue;
    const px=x+R(-4,4),pz=z+R(-4,4);
    if(nearestRoad(px,pz,14)||nearVRoad(px,pz,10))continue;
    if(riverDist(px,pz).d<RIVER_HW+22)continue;if(!footFree(px,pz,8))continue;
    if(slopeY(px,pz)<0.88&&zn.t!=='sub')continue;if(slopeY(px,pz)<0.8)continue;
    let ry=roadDir(px,pz);if(ry===null)ry=0.3;ry+=R(-0.05,0.05);
    let w,d,h,rt;
    if(zn.t==='alt'){w=R(10,15);d=R(9,14);h=R(9,15);rt=rng()<0.6?'giebel':'trauf';}
    else if(zn.t==='city'){w=R(11,15);d=R(14,26);h=R(13,20);rt=rng()<0.35?'trauf':'flat';}
    else if(zn.t==='sub'){w=R(8.5,12);d=R(8.5,12);h=R(5.5,8.5);rt=rng()<0.5?'giebel':'trauf';if(rng()<0.12){w=R(11,14);d=R(28,45);h=R(10,16);rt='flat';}}
    else{w=R(20,40);d=R(30,60);h=R(7,12);rt='flat';}
    if(!occFree(px,pz,ry,w,d)||!cornersClear(px,pz,ry,w,d,5.8))continue;
    const k=zn.t==='alt'&&Math.hypot(px-fisch[0],pz-fisch[1])<150?'fach':zn.t==='sub'&&d>20?'city':zn.t;
    add(k,px,pz,ry,w,d,h,rt);}
  const box=facadeBox();for(const k in items)if(items[k].length)chunkedInstances(box,mats[k],items[k]);
  chunkedInstances(gableGeo(),new THREE.MeshStandardMaterial({map:roofTileTex(),roughness:0.8,flatShading:true,side:THREE.DoubleSide}),roofs);
  streetLamps();
  console.log('Häuserzeilen',rows);
  return Object.values(items).reduce((a,b)=>a+b.length,0);
}
// Straßenlaternen entlang der Strecke in der Stadt
function streetLamps(){const parts=[[tr(new THREE.CylinderGeometry(0.07,0.1,5.6,6),[0,2.8,0]),0x3b4048],[tr(new THREE.BoxGeometry(0.08,0.08,1.3),[0,5.55,0.6]),0x3b4048],
    [tr(new THREE.BoxGeometry(0.5,0.18,0.7),[0,5.45,1.2]),0x2b2f36],[tr(new THREE.BoxGeometry(0.42,0.06,0.6),[0,5.34,1.2]),0xfff3c4]];
  const geo=merge(parts),items=[];
  for(let i=0;i<N;i+=Math.round(32/ds)){const zn=ulmZone(RX[i],RZ[i]);if(zn.d<0.3)continue;const side=(Math.floor(i/Math.round(32/ds))%2)?1:-1,[x,z]=lateralPoint(i,side*6.4);
    if(riverDist(x,z).d<RIVER_HW+12||nearestRoad(x,z,5.4))continue;items.push({x,z,y:groundH(x,z)-0.1,sx:1,sy:1,sz:1,ry:Math.atan2(RTX[i],RTZ[i])+(side>0?Math.PI:0),c:0xffffff});}
  chunkedInstances(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.6}),items);}
/* ---- Wahrzeichen ---- */
function std(c,r=0.8,m=0,extra={}){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,...extra});}
// Viele Einzelteile eines Bauwerks zu wenigen Meshes (je Material) zusammenfassen – spart Zeichenaufrufe
function mergeGroup(G){G.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(G.matrixWorld).invert(),buckets=new Map(),drop=[],keep=[];
  G.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.isShaderMaterial)return;
    let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();for(const k of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(k))g.deleteAttribute(k);
    if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));const key=o.material.uuid+(g.attributes.color?'c':'');
    if(!buckets.has(key))buckets.set(key,{m:o.material,list:[]});buckets.get(key).list.push(g);drop.push(o);});
  if(drop.length<2)return;for(const o of drop)o.parent.remove(o);
  for(const {m,list} of buckets.values()){let n=0;for(const g of list)n+=g.attributes.position.count;const col=list.every(g=>g.attributes.color);
    const P=new Float32Array(n*3),Nn=new Float32Array(n*3),U=new Float32Array(n*2),C=col?new Float32Array(n*3):null;let o=0;
    for(const g of list){const c=g.attributes.position.count;P.set(g.attributes.position.array,o*3);Nn.set(g.attributes.normal.array,o*3);U.set(g.attributes.uv.array,o*2);if(C)C.set(g.attributes.color.array,o*3);o+=c;}
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(P,3));bg.setAttribute('normal',new THREE.BufferAttribute(Nn,3));bg.setAttribute('uv',new THREE.BufferAttribute(U,2));if(C)bg.setAttribute('color',new THREE.BufferAttribute(C,3));
    const mm=new THREE.Mesh(bg,m);mm.castShadow=mm.receiveShadow=true;G.add(mm);}}
// Bauwerk an p=[x,z] setzen; steht der echte Grundriss (Bounding-Box) auf einer Straße oder im Fluss, wird es auf den
// nächsten freien Platz geschoben (p wird angepasst). o.rect: eigener Grundriss [x0,x1,z0,z1] (lokal), o.fixed: nicht schieben
function landFit(group,p,ry,o){let R=o.rect;if(!R){group.position.set(0,0,0);group.rotation.set(0,0,0);group.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(group);R=[b.min.x,b.max.x,b.min.z,b.max.z];}
  const c=Math.cos(ry),sn=Math.sin(ry),st=Math.max(2.5,Math.min(6,(R[1]-R[0])/5,(R[3]-R[2])/5)),clr=o.clr||6.2;
  const free=(px,pz)=>{for(let u=R[0];u<=R[1]+0.01;u+=st)for(let v=R[2];v<=R[3]+0.01;v+=st){const x=px+c*u+sn*v,z=pz-sn*u+c*v;
      if(nearestRoad(x,z,clr))return false;const vr=nearVRoad(x,z,9);if(vr&&vr.d<(vr.s.w||4)+1)return false;if(riverDist(x,z).d<RIVER_HW+3)return false;}return true;};
  if(o.fixed)return R;
  for(let r=0;r<=(o.maxR||130);r+=3){const n=r?Math.max(8,Math.round(r*1.2)):1;for(let a=0;a<n;a++){const an=a/n*Math.PI*2,x=p[0]+Math.cos(an)*r,z=p[1]+Math.sin(an)*r;
    if(free(x,z)){if(r)console.log('Bauwerk verschoben um',r,'m');p[0]=x;p[1]=z;return R;}}}
  console.warn('Kein freier Platz für Bauwerk bei',p.map(Math.round));return R;}
function addAt(group,p,ry=0,yOff=0,o={}){const R=landFit(group,p,ry,o),x=p[0],z=p[1],y=finalHeight(x,z)+yOff;
  {const c=Math.cos(ry),sn=Math.sin(ry),cs=[[R[0],R[2]],[R[1],R[2]],[R[0],R[3]],[R[1],R[3]]].map(([u,v])=>[x+c*u+sn*v,z-sn*u+c*v]);
    if(!o.noCam){group.position.set(0,0,0);group.rotation.set(0,0,0);group.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(group);camOccAdd([cs[0],cs[1],cs[3],cs[2]],y+bb.max.y);}
    const xs=cs.map(q=>q[0]),zs=cs.map(q=>q[1]);LANDMARK_FOOT.push({x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,hx:(Math.max(...xs)-Math.min(...xs))/2,hz:(Math.max(...zs)-Math.min(...zs))/2});}group.position.set(x,y,z);group.rotation.y=ry;group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});mergeGroup(group);scene.add(group);return group;}
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y+h/2,z);return m;}
function gothicTex(cols,rows,base='#cdbca3'){return canvasTex(512,512,(x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);
  for(let k=0;k<4000;k++){const v=Math.random()*30-15;x.fillStyle=`rgba(${120+v},${100+v},${80+v},.08)`;x.fillRect(Math.random()*w,Math.random()*h,6,3);}
  const cw=w/cols,rh=h/rows;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x0=c*cw+cw*0.3,ww=cw*0.4,y0=r*rh+rh*0.12,hh=rh*0.76;
    x.fillStyle='#2b3440';x.beginPath();x.moveTo(x0,y0+hh);x.lineTo(x0,y0+ww*0.6);x.quadraticCurveTo(x0,y0,x0+ww/2,y0-ww*0.1);x.quadraticCurveTo(x0+ww,y0,x0+ww,y0+ww*0.6);x.lineTo(x0+ww,y0+hh);x.fill();
    x.strokeStyle='#8a7c66';x.lineWidth=2;x.beginPath();x.moveTo(x0+ww/2,y0);x.lineTo(x0+ww/2,y0+hh);x.stroke();
    x.fillStyle='rgba(120,90,60,.35)';x.fillRect(c*cw,0,cw*0.1,h);}});}
function spire(r0,h,mat,seg=8){const g=new THREE.ConeGeometry(r0,h,seg);g.translate(0,h/2,0);return new THREE.Mesh(g,mat);}
function spatz(){const g=new THREE.Group(),brown=std(0x9a6a3a,0.8),light=std(0xe8d3b0,0.8),dark=std(0x4a3222,0.8);
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.5,12,10),brown);body.scale.set(0.8,0.75,1.1);body.position.y=0.55;g.add(body);
  const belly=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8),light);belly.scale.set(0.75,0.7,0.95);belly.position.set(0,0.45,0.08);g.add(belly);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.33,12,10),brown);head.position.set(0,1.0,0.42);g.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8,0,Math.PI*2,0,Math.PI/2.4),std(0x6b6f78,0.8));cap.position.copy(head.position);g.add(cap);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.26,6),std(0xf0b030,0.6));beak.rotation.x=Math.PI/2;beak.position.set(0,0.98,0.78);g.add(beak);
  for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6),std(0x111111,0.3));e.position.set(s*0.16,1.08,0.68);g.add(e);
    const w=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6),dark);w.scale.set(0.3,0.6,1.0);w.position.set(s*0.38,0.62,-0.05);g.add(w);}
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.06,0.55),dark);tail.position.set(0,0.62,-0.62);tail.rotation.x=-0.5;g.add(tail);
  const straw=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1.4,4),std(0xf2d060,0.7));straw.rotation.z=Math.PI/2;straw.position.set(0,0.94,0.86);g.add(straw);
  for(const s of [-1,1]){const l=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.3,4),std(0xd08a30));l.position.set(s*0.14,0.12,0.05);g.add(l);}
  return g;}
function buildMuenster(p){
  const G=new THREE.Group(),stone=std(0xd8c9b1,0.9),stoneD=std(0xc4b398,0.9),roof=std(0x5f6468,0.75,0,{side:THREE.DoubleSide}),win=new THREE.MeshStandardMaterial({map:gothicTex(8,1),roughness:0.9}),
    winT=new THREE.MeshStandardMaterial({map:gothicTex(2,3),roughness:0.9});
  // Mittelschiff (41,6 m), Seitenschiffe (20,6 m), Chor, Westturm 161,5 m, Chortürme 86 m – Achse West→Ost (x)
  const nave=box(84,41.6,16,win,-1,0,0);G.add(nave);
  const rN=new THREE.Mesh(gableGeo(),roof);rN.scale.set(17,17,84);rN.rotation.y=Math.PI/2;rN.position.set(-1,41.6,0);
  // Satteldach entlang x: gableGeo hat First entlang z → drehen
  G.add(rN);
  for(const s of [-1,1]){G.add(box(84,20.6,16,win,-1,0,s*16));
    const ra=new THREE.Mesh(new THREE.BoxGeometry(84,0.6,17),roof);ra.position.set(-1,21,s*16.2);ra.rotation.x=s*-0.32;G.add(ra);
    for(let i=0;i<10;i++){const bx=-42+i*9.3;G.add(box(2.2,24,3,stoneD,bx,0,s*24.6));const pn=spire(1.3,7,stoneD,4);pn.position.set(bx,24,s*24.6);G.add(pn);
      const fb=box(1.2,1.2,9,stoneD,bx,32,s*13.5);fb.rotation.x=s*0.55;G.add(fb);}}
  // Ulmer Spatz auf dem Dachfirst
  {const sp=spatz();sp.position.set(-22,41.6+17-0.6,0);sp.scale.setScalar(2.6);sp.rotation.y=Math.PI/2;G.add(sp);}
  // Chor mit Apsis
  G.add(box(24,30,15,win,52,0,0));const ap=new THREE.Mesh(new THREE.CylinderGeometry(7.5,7.5,30,8,1,false,0,Math.PI),win);ap.position.set(64,15,0);ap.rotation.y=-Math.PI/2;G.add(ap);
  const rc=new THREE.Mesh(gableGeo(),roof);rc.scale.set(15.5,13,24);rc.rotation.y=Math.PI/2;rc.position.set(52,30,0);G.add(rc);
  const rap=new THREE.Mesh(new THREE.ConeGeometry(7.8,13,8,1,false,0,Math.PI),roof);rap.position.set(64,36.5,0);rap.rotation.y=-Math.PI/2;G.add(rap);
  // Chortürme
  for(const s of [-1,1]){G.add(box(8,52,8,winT,38,0,s*10.5));const o=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.9,12,8),stone);o.position.set(38,58,s*10.5);G.add(o);
    const sp=spire(3.6,22,stoneD,8);sp.position.set(38,64,s*10.5);G.add(sp);}
  // Westturm: Schaft, Achteck, durchbrochener Helm
  G.add(box(24,72,24,winT,-55,0,0));
  const portal=box(1,14,9,std(0x3a3128),-67.1,0,0);G.add(portal);
  for(const sx of [-1,1])for(const sz of [-1,1]){const pn=spire(1.6,14,stoneD,4);pn.position.set(-55+sx*11,72,sz*11);G.add(pn);}
  const oct=new THREE.Mesh(new THREE.CylinderGeometry(8.6,9.8,30,8),winT);oct.position.set(-55,87,0);G.add(oct);
  const gal=new THREE.Mesh(new THREE.CylinderGeometry(10.2,10.2,1.2,8),stoneD);gal.position.set(-55,102.4,0);G.add(gal);
  const helmTex=canvasTex(256,512,(x,w,h)=>{x.fillStyle='#cdbca3';x.fillRect(0,0,w,h);x.fillStyle='rgba(40,50,60,.85)';
    for(let r=0;r<16;r++)for(let c=0;c<4;c++){const cx=c*w/4+w/8,cy=r*h/16+h/32;x.beginPath();x.ellipse(cx,cy,w/14,h/48,0,0,7);x.fill();}
    x.strokeStyle='#a89679';x.lineWidth=5;for(let c=0;c<=4;c++){x.beginPath();x.moveTo(c*w/4,0);x.lineTo(c*w/4,h);x.stroke();}},false);
  const helm=spire(8.2,56,new THREE.MeshStandardMaterial({map:helmTex,roughness:0.9}),8);helm.position.set(-55,103,0);G.add(helm);
  const fin=new THREE.Mesh(new THREE.SphereGeometry(0.9,8,6),stoneD);fin.position.set(-55,160.5,0);G.add(fin);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,pn=spire(0.9,9,stoneD,4);pn.position.set(-55+Math.cos(a)*9.6,103,Math.sin(a)*9.6);G.add(pn);}
  addAt(G,p,0,-1,{fixed:true});LANDMARK_FOOT.push({x:p[0]+2,z:p[1],hx:72,hz:28});LANDMARK_FOOT.push({x:p[0]-60,z:p[1],hx:140,hz:62});return G;}
function buildGeorg(p){
  const G=new THREE.Group(),brick=new THREE.MeshStandardMaterial({map:canvasTex(256,256,(x,w,h)=>{x.fillStyle='#9c4a36';x.fillRect(0,0,w,h);
    for(let r=0;r<64;r++)for(let c=0;c<16;c++){const v=Math.random()*30-15;x.fillStyle=`rgb(${150+v},${72+v/2},${54+v/2})`;x.fillRect(c*16+(r%2)*8,r*4,15,3);}},true),roughness:0.9}),
    copper=std(0x5f9e8f,0.55,0.25),roof=std(0x8b3a2b,0.8,0,{side:THREE.DoubleSide}),win=new THREE.MeshStandardMaterial({map:gothicTex(6,1,'#a45240'),roughness:0.9});
  brick.map.repeat.set(4,4);
  G.add(box(22,24,46,win,0,0,-6));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(23,14,46);r.position.set(0,24,-6);G.add(r);
  G.add(box(30,16,10,win,0,0,-22));
  // Turm in voller Schiffbreite vorn (Richtung Olgastraße), Helm mit vier Ecktürmchen
  G.add(box(20,52,12,brick,0,0,22));const gab=new THREE.Mesh(gableGeo(),brick);gab.scale.set(20,8,12);gab.rotation.y=Math.PI/2;gab.position.set(0,52,22);G.add(gab);
  const h=spire(6.5,30,copper,8);h.position.set(0,56,22);G.add(h);
  for(const sx of [-1,1])for(const sz of [-1,1]){const t=spire(1.4,12,copper,6);t.position.set(sx*8.5,52,22+sz*4.5);G.add(t);}
  const cross=box(0.4,3,0.4,std(0xd4af37,0.4,0.8),0,86,22);G.add(cross);
  addAt(G,p,0,-0.5);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:16,hz:32});}
function buildPaulus(p){
  const G=new THREE.Group(),conc=std(0xbfb8ab,0.95),roof=std(0x70716f,0.8,0,{side:THREE.DoubleSide});
  G.add(box(48,20,22,conc,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(22.5,9,48);r.rotation.y=Math.PI/2;r.position.set(0,20,0);G.add(r);
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(11,11,18,24),conc);cyl.position.set(-26,9,0);G.add(cyl);
  for(const s of [-1,1]){const t=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.4,40,16),conc);t.position.set(26,20,s*8);G.add(t);
    const pom=new THREE.Mesh(new THREE.SphereGeometry(4.2,16,12),conc);pom.scale.set(1,1.25,1);pom.position.set(26,44,s*8);G.add(pom);
    const sp=spire(0.8,6,conc,6);sp.position.set(26,48.5,s*8);G.add(sp);}
  addAt(G,p,0,-0.5);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:40,hz:20});}
function buildRathaus(p){
  const G=new THREE.Group(),paint=new THREE.MeshStandardMaterial({map:canvasTex(512,256,(x,w,h)=>{x.fillStyle='#e7cfa3';x.fillRect(0,0,w,h);
    const cols=['#a8382f','#2f6b8a','#c9952e','#3d7a4a','#7a3b6e'];for(let k=0;k<14;k++){x.fillStyle=cols[k%5];x.globalAlpha=0.75;x.fillRect(k*w/14+4,40,w/14-8,90);}
    x.globalAlpha=1;x.fillStyle='#3a4a5a';for(let r=0;r<2;r++)for(let k=0;k<12;k++)x.fillRect(12+k*w/12,150+r*50,18,30);
    x.fillStyle='#1d2a36';x.beginPath();x.arc(w*0.5,90,28,0,7);x.fill();x.fillStyle='#d4af37';x.beginPath();x.arc(w*0.5,90,22,0,7);x.fill();},false),roughness:0.85}),
    roof=std(0x9c4a32,0.8,0,{side:THREE.DoubleSide});
  G.add(box(48,17,20,paint,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(20.5,13,48);r.rotation.y=Math.PI/2;r.position.set(0,17,0);G.add(r);
  // Stufengiebel im Osten
  for(let i=0;i<5;i++){G.add(box(1.2,3,20-i*4,paint,24.6,17+i*2.6,0));}
  addAt(G,p,0,-0.5);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:28,hz:14});}
function buildStadthaus(p){const G=new THREE.Group(),w=std(0xf7f7f4,0.5),gl=std(0x5c7187,0.2,0.4);
  G.add(box(34,16,24,w,0,0,0));const c=new THREE.Mesh(new THREE.CylinderGeometry(12,12,16,32,1,false,0,Math.PI),w);c.position.set(17,8,0);c.rotation.y=-Math.PI/2;G.add(c);
  G.add(box(30,3,0.4,gl,0,6,-12.2));G.add(box(0.4,10,20,gl,-17.2,3,0));addAt(G,p,0.12,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:30,hz:16});}
function buildMetzgerturm(p){const G=new THREE.Group(),st=std(0xd9cdb6,0.9),roof=std(0x9c4a32,0.8,0,{side:THREE.DoubleSide});
  const t=box(8,28,8,new THREE.MeshStandardMaterial({map:gothicTex(1,3,'#d9cdb6'),roughness:0.9}),0,0,0);G.add(t);
  const r=spire(6.2,10,roof,4);r.rotation.y=Math.PI/4;r.position.set(0,28,0);G.add(r);G.rotation.z=0.035;
  addAt(G,p,0,-0.5);G.rotation.z=0.04;LANDMARK_FOOT.push({x:p[0],z:p[1],hx:8,hz:8});}
function buildSchiefesHaus(p){const G=new THREE.Group(),tim=new THREE.MeshStandardMaterial({map:canvasTex(256,256,(x,w,h)=>{x.fillStyle='#f1e9d6';x.fillRect(0,0,w,h);
    x.strokeStyle='#5a3a22';x.lineWidth=7;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*w/4,0);x.lineTo(i*w/4,h);x.stroke();}for(let j=0;j<=3;j++){x.beginPath();x.moveTo(0,j*h/3);x.lineTo(w,j*h/3);x.stroke();}
    for(let i=0;i<4;i++){x.beginPath();x.moveTo(i*w/4,h/3);x.lineTo((i+1)*w/4,2*h/3);x.stroke();}x.fillStyle='#3d4f61';for(let i=0;i<4;i++)x.fillRect(i*w/4+18,h/3+12,26,30);},false),roughness:0.9}),roof=std(0x8a3b2a,0.8,0,{side:THREE.DoubleSide});
  const b=box(10,11,9,tim,0,0,0);G.add(b);const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(9.5,6,10.5);r.position.set(0,11,0);G.add(r);G.rotation.z=0.09;
  addAt(G,p,0.4,-0.3);G.rotation.z=0.1;LANDMARK_FOOT.push({x:p[0],z:p[1],hx:8,hz:8});
  // Blau-Kanal im Fischerviertel
  const ch=new THREE.Mesh(new THREE.PlaneGeometry(7,120),std(0x4f7f7a,0.2,0.1));ch.rotation.x=-Math.PI/2;ch.rotation.z=0.75;ch.position.set(p[0]+12,finalHeight(p[0]+12,p[1])-0.4,p[1]+35);scene.add(ch);}
function buildHbf(p){const G=new THREE.Group(),w=std(0xe4e0d8,0.8),gl=std(0x4f6578,0.2,0.4),roof=std(0x6b6e72,0.7,0,{side:THREE.DoubleSide});
  G.add(box(26,15,120,w,0,0,0));G.add(box(26.2,3,118,gl,0,8,0));G.add(box(30,1.2,124,roof,0,15,0));
  // Gleisfeld westlich
  const tracks=new THREE.Group(),rail=std(0x6a6a6a,0.5,0.6),ballast=std(0x8d857c,1);
  for(let k=0;k<10;k++){const tx=-30-k*6;tracks.add(box(4,0.3,900,ballast,tx,0,-170));for(const s of [-0.72,0.72])tracks.add(box(0.12,0.4,900,rail,tx+s,0.3,-170));}
  for(let k=0;k<4;k++){const px=-33-k*12;tracks.add(box(3,0.9,220,std(0xb5b0a6,0.9),px,0,-40));tracks.add(box(4,0.3,200,roof,px,4.2,-40));for(let i=0;i<10;i++)tracks.add(box(0.3,4.2,0.3,rail,px,0,-130+i*20));}
  G.add(tracks);addAt(G,p,0,-0.3,{rect:[-15,15,-62,62]});LANDMARK_FOOT.push({x:p[0]-35,z:p[1]-170,hx:80,hz:460});}
function buildWilhelmsburg(p){const G=new THREE.Group(),lime=new THREE.MeshStandardMaterial({map:canvasTex(256,128,(x,w,h)=>{x.fillStyle='#d8d2c2';x.fillRect(0,0,w,h);
    x.fillStyle='#3e4650';for(let r=0;r<3;r++)for(let k=0;k<12;k++)x.fillRect(6+k*21,14+r*38,9,18);},true),roughness:0.95}),roof=std(0x7c8186,0.6,0.3,{side:THREE.DoubleSide});
  lime.map.repeat.set(8,1);
  // Vierflügelanlage 200 × 130 m mit Innenhof, Tor im Südflügel
  G.add(box(200,19,18,lime,0,0,-56));G.add(box(18,19,94,lime,-91,0,0));G.add(box(18,19,94,lime,91,0,0));
  G.add(box(84,19,18,lime,-58,0,56));G.add(box(84,19,18,lime,58,0,56));G.add(box(32,8,18,lime,0,11,56));
  for(const [x,z,w,d] of [[0,-56,200,18],[-91,0,18,94],[91,0,18,94],[-58,56,84,18],[58,56,84,18]]){const r=new THREE.Mesh(new THREE.BoxGeometry(w+1,1.2,d+1),roof);r.position.set(x,19.6,z);G.add(r);}
  for(const s of [-1,1]){const t=box(14,30,14,lime,s*24,0,58);G.add(t);const tr=new THREE.Mesh(new THREE.BoxGeometry(15,1.5,15),roof);tr.position.set(s*24,30.7,58);G.add(tr);}
  addAt(G,p,0,-0.8);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:108,hz:72});}
function buildFort(p,size,name){const G=new THREE.Group(),wall=std(0xb7a68c,0.95),grass=std(0x5f8a45,1);
  const n=5;for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,x0=Math.cos(a0)*size,z0=Math.sin(a0)*size,x1=Math.cos(a1)*size,z1=Math.sin(a1)*size;
    const l=Math.hypot(x1-x0,z1-z0),w=box(l,8,6,wall,0,0,0);w.position.set((x0+x1)/2,4,(z0+z1)/2);w.rotation.y=-Math.atan2(z1-z0,x1-x0);G.add(w);
    const top=new THREE.Mesh(new THREE.BoxGeometry(l,2,10),grass);top.position.set((x0+x1)/2,8.5,(z0+z1)/2);top.rotation.y=-Math.atan2(z1-z0,x1-x0);G.add(top);}
  G.add(box(size*0.7,10,size*0.35,std(0xc9b99c,0.9),0,0,0));
  addAt(G,p,0,-1);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:size+10,hz:size+10});}
function buildUni(p){const G=new THREE.Group(),c=std(0xc5c7c4,0.85),gl=std(0x4f6578,0.2,0.4),r=std(0x7a7d80,0.8);
  // Kammstruktur: langer Rückgrat-Gang Ost–West mit Flügeln nach Nord und Süd, farbige Treppentürme je Bereich
  const accents=[0xd9822b,0x2f7fbf,0x4c9a4a,0xc0392b,0xe0b83a,0x7d5ba6,0x2a9d8f];
  G.add(box(620,9,14,c,0,0,0));G.add(box(620.4,2.2,14.4,gl,0,4,0));G.add(box(622,0.8,16,r,0,9,0));
  for(let k=0;k<7;k++){const x=-270+k*90,acc=std(accents[k],0.6);
    for(const s of [-1,1]){const len=k%2?46:58;G.add(box(30,16,len,c,x,0,s*(7+len/2)));
      for(let f=0;f<4;f++)G.add(box(30.4,1.8,len+0.4,gl,x,2.5+f*3.6,s*(7+len/2)));
      G.add(box(32,1,len+2,r,x,16,s*(7+len/2)));
      G.add(box(7,20,7,acc,x+18,0,s*(10+len*0.55)));}
    G.add(box(10,22,10,acc,x,0,0));}
  // Forum/Mensa und Bibliothek
  G.add(box(60,12,40,std(0xd8d2c4,0.8),40,0,-110));G.add(box(60.4,3,40.4,gl,40,4,-110));
  addAt(G,p,0,-1);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:330,hz:130});
  // Science Park / Uni West
  const SP=new THREE.Group();for(let k=0;k<5;k++){const b=box(38,14,26,std([0xe6e3dc,0xd2d7da,0xdcd2c2][k%3],0.6),k*58,0,(k%2)*34);SP.add(b);SP.add(box(38.4,3,26.4,gl,k*58,6,(k%2)*34));}
  addAt(SP,[p[0]-520,p[1]+60],0.1,-1);
  // Universitätsklinikum: mehrere große Bettenhäuser
  const K=new THREE.Group(),kw=std(0xe2e2df,0.8);
  K.add(box(160,24,60,kw,0,0,0));K.add(box(160.4,3,60.4,gl,0,12,0));K.add(box(60,36,24,kw,-30,0,-50));K.add(box(60.4,2.5,24.4,gl,-30,20,-50));
  K.add(box(90,18,40,std(0xd6dade,0.7),120,0,20));K.add(box(90.4,3,40.4,gl,120,8,20));K.add(box(14,1,14,std(0xdd3333,0.6),-30,36.2,-50)); // Hubschrauberlandeplatz
  addAt(K,[...ULM.places.uniklinik],0.2,-1);}
function buildCityWall(){ // Stadtmauer am Nordufer zwischen Adlerbastei und Herdbrücke
  const mat=new THREE.MeshStandardMaterial({map:canvasTex(256,64,(x,w,h)=>{x.fillStyle='#bfae92';x.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let c=0;c<16;c++){const v=Math.random()*24-12;x.fillStyle=`rgb(${180+v},${165+v},${138+v})`;x.fillRect(c*16+(r%2)*8,r*8,15,7);}},true),roughness:0.95});
  mat.map.repeat.set(20,1);const P=[],I=[],UV=[],r=ULM.river;
  const pts=[];for(let i=0;i<r.length;i++){if(r[i][0]<-330||r[i][0]>330)continue;const a=r[Math.max(0,i-1)],b=r[Math.min(r.length-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz);tx/=l;tz/=l;
    let nx=-tz,nz=tx,sd=1;if(nz>0){nx=-nx;nz=-nz;sd=-1;}const w=(sd>0?RIVW[0].p[i]:RIVW[0].m[i])+7,q=[r[i][0]+nx*w,r[i][1]+nz*w];q.road=!!nearestRoad(q[0],q[1],7);pts.push(q);} // nicht über die Strecke
  let u=0;pts.forEach((q,i)=>{const h0=WATER_Y-1,h1=Math.max(finalHeight(q[0],q[1])+5,WATER_Y+9);if(i)u+=Math.hypot(q[0]-pts[i-1][0],q[1]-pts[i-1][1])/12;
    P.push(q[0],h0,q[1],q[0],h1,q[1]);UV.push(u,0,u,1);if(i<pts.length-1&&!q.road&&!pts[i+1].road){const k=i*2;I.push(k,k+2,k+1,k+1,k+2,k+3);}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);mat.side=THREE.DoubleSide;m.castShadow=true;m.receiveShadow=true;scene.add(m);}
function buildBridges(){ // Geländer, Brückenplatte und Pfeiler überall, wo die Strecke die Donau quert
  let run=[];const flush=()=>{if(run.length>2){const pts=run.map(i=>[RX[i],RZ[i],RH[i]]);bridgeRails(pts,q=>q[2]+0.25,4.9,5.4);}run=[];};
  for(let i=0;i<N;i+=2){if(riverDist(RX[i],RZ[i]).d<RIVER_HW+2.5)run.push(i);else flush();}flush();}
function buildVisualRoads(){
  const tex=asphaltTex(256,1024,{edge:0.05,center:true,gutter:0.03});tex.wrapS=THREE.ClampToEdgeWrapping;
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:0.9,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  for(const rd of ULM.vroads){const raw=rd.p,p=[];for(let i=0;i<raw.length-1;i++){const a=raw[i],b=raw[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/8));
      for(let k=0;k<n;k++)p.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,i]);}p.push([raw[raw.length-1][0],raw[raw.length-1][1],raw.length-1]);const P=[],UV=[],I=[];const Wd=rd.w||5.5;let v=0;const span=[];
    for(let i=0;i<p.length;i++){const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
      if(i)v+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1])/18;
      const RD=riverDist(p[i][0],p[i][1]),rdst=RD.d,deck=RD.wy+(RD.s?clamp(RD.hw*0.22,2.5,7.5):7.5),bw=1-sstep((rdst-RIVER_HW-6)/34);
      if(rdst<RIVER_HW+3)span.push([p[i][0],p[i][1]]);else if(span.length){bridgeRails(span,q=>deck+0.18,Wd-0.4);span.length=0;}
      for(const s of [-1,1]){const x=p[i][0]-tz*s*Wd,z=p[i][1]+tx*s*Wd,th=Math.max(groundH(x,z),groundH(p[i][0],p[i][1]));let y=th+(Math.max(th,deck)-th)*bw;P.push(x,y+0.22,z);UV.push(s<0?0:1,v);}
      if(i<p.length-1){const k=i*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.receiveShadow=true;scene.add(m);if(span.length){const RD=riverDist(span[0][0],span[0][1]);bridgeRails(span,q=>RD.wy+7.68,Wd-0.4);}}}
function bridgeRails(pts,yAt,hw,deckW){const rail=std(0xe9eef2,0.5,0.1),pier=std(0xd9cfbb,0.9),slab=std(0xd2c8b4,0.9);let acc=0;const BG=new THREE.Group();
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<0.5)continue;const tx=(b[0]-a[0])/l,tz=(b[1]-a[1])/l,ya=yAt(a),yb=yAt(b);
    for(const s of [-1,1]){const ox=-tz*s*hw,oz=tx*s*hw,m=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,l+0.1),rail);
      m.position.set((a[0]+b[0])/2+ox,(ya+yb)/2+1.05,(a[1]+b[1])/2+oz);m.lookAt(b[0]+ox,yb+1.05,b[1]+oz);BG.add(m);
      if(acc<=0){const post=new THREE.Mesh(new THREE.BoxGeometry(0.14,1.05,0.14),rail);post.position.set(a[0]+ox,ya+0.52,a[1]+oz);BG.add(post);}}
    acc=acc<=0?6:acc-l;
    if(deckW){const d=new THREE.Mesh(new THREE.BoxGeometry(deckW*2,1.3,l+0.3),slab);d.position.set((a[0]+b[0])/2,(ya+yb)/2-0.68,(a[1]+b[1])/2);d.lookAt(b[0],yb-0.68,b[1]);d.receiveShadow=true;BG.add(d);}
    if(i%3===1){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],ym=(ya+yb)/2;const wy=riverDist(mid[0],mid[1]).wy,p2=new THREE.Mesh(new THREE.BoxGeometry(3,ym-wy+3,7),pier);p2.position.set(mid[0],(ym+wy-3)/2,mid[1]);p2.rotation.y=Math.atan2(tx,tz);BG.add(p2);}}mergeGroup(BG);scene.add(BG);}
function bubbleSprite(t){const c=document.createElement('canvas'),x=c.getContext('2d');x.font='600 44px Fredoka,system-ui,sans-serif';const tw=Math.ceil(x.measureText(t).width)+60;
  c.width=tw;c.height=110;x.font='600 44px Fredoka,system-ui,sans-serif';const r=22,b=78;
  x.fillStyle='#fffaf0';x.strokeStyle='#1e0f3a';x.lineWidth=6;x.beginPath();x.moveTo(r+4,4);x.arcTo(tw-4,4,tw-4,b,r);x.arcTo(tw-4,b,4,b,r);x.lineTo(tw/2+14,b);x.lineTo(tw/2,106);x.lineTo(tw/2-14,b);x.arcTo(4,b,4,4,r);x.arcTo(4,4,tw-4,4,r);x.closePath();x.fill();x.stroke();
  x.fillStyle='#1e0f3a';x.textAlign='center';x.textBaseline='middle';x.fillText(t,tw/2,43);
  const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false,depthTest:false,sizeAttenuation:false}));
  const hgt=0.075;s.scale.set(hgt*tw/110,hgt,1);s.center.set(0.5,0.0);s.renderOrder=5;return s;}
function landmarkLabel(text,p,y){mapLabel(text.split(' · ')[0],p[0],p[1],/Münster|Georg|Wilhelmsburg|Universität|Hauptbahnhof/.test(text)?'key':'lm');const sp=bubbleSprite(text);sp.position.set(p[0],finalHeight(p[0],p[1])+y,p[1]);sp.userData.land=true;scene.add(sp);LABELS.push(sp);}
let LABELS=[];
/* ---- weitere Wahrzeichen zur Orientierung ---- */
// Ungefähre Koordinate → nächster freier Platz (keine Straße, kein Fluss, kein anderes Bauwerk)
function placeFree(lon,lat,hx,hz,ry){const [x0,z0]=ulmLL(lon,lat);
  const ok=(x,z)=>{const c=Math.cos(ry),sn=Math.sin(ry);for(const [u,v] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0],[-1,0],[1,0],[0,-1],[0,1]]){const px=x+c*u*hx+sn*v*hz,pz=z-sn*u*hx+c*v*hz;
    if(nearestRoad(px,pz,7.5)||nearVRoad(px,pz,6.5)||riverDist(px,pz).d<RIVER_HW+6||!footFree(px,pz,1))return false;}return true;};
  for(let r=0;r<=110;r+=5)for(let a=0;a<(r?Math.max(8,r/2):1);a++){const an=a/Math.max(8,r/2)*Math.PI*2,x=x0+Math.cos(an)*r,z=z0+Math.sin(an)*r;if(ok(x,z))return [x,z];}
  return [x0,z0];}
function voluteGable(w,h,mat,depth){ // geschwungener Barockgiebel als Scheibe
  const sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(-w/2,h*0.18);sh.quadraticCurveTo(-w*0.48,h*0.42,-w*0.3,h*0.45);sh.quadraticCurveTo(-w*0.34,h*0.7,-w*0.16,h*0.74);
  sh.quadraticCurveTo(-w*0.16,h*0.95,0,h);sh.quadraticCurveTo(w*0.16,h*0.95,w*0.16,h*0.74);sh.quadraticCurveTo(w*0.34,h*0.7,w*0.3,h*0.45);sh.quadraticCurveTo(w*0.48,h*0.42,w/2,h*0.18);sh.lineTo(w/2,0);
  const g=new THREE.ExtrudeGeometry(sh,{depth:depth||0.8,bevelEnabled:false,curveSegments:6});g.translate(0,0,-(depth||0.8)/2);return new THREE.Mesh(g,mat);}
function plasterTex(base,lines,winCol){return canvasTex(256,256,(x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);
  if(lines){x.strokeStyle=lines;x.lineWidth=1.5;for(let y=0;y<h;y+=16){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();for(let k=((y/16)%2)*24;k<w;k+=48){x.beginPath();x.moveTo(k,y);x.lineTo(k,y+16);x.stroke();}}}
  x.fillStyle=winCol||'#3e4d5c';for(let r=0;r<3;r++)for(let k=0;k<6;k++){x.fillRect(14+k*42,26+r*80,18,40);}},true);}
function buildKornhaus(){const ry=0.08,p=placeFree(9.99497,48.39900,24,11,ry),G=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:plasterTex('#e9dcc2','#c7b48f'),roughness:0.9}),roof=std(0x9c4a32,0.8,0,{side:THREE.DoubleSide});
  m.map.repeat.set(3,1);G.add(box(48,14,20,m,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(20.6,19,48.6);r.rotation.y=Math.PI/2;r.position.set(0,14,0);G.add(r);
  for(const s of [-1,1]){const gb=voluteGable(20,22,std(0xe9dcc2,0.9),1.2);gb.rotation.y=Math.PI/2;gb.position.set(s*24.3,14,0);G.add(gb);}
  addAt(G,p,ry,-0.4);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:27,hz:27});landmarkLabel('Kornhaus',p,40);}
function buildSchwoerhaus(){const ry=0.5,p=placeFree(9.9904,48.3962,11,8,ry),G=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:plasterTex('#f3ead8',null),roughness:0.9}),roof=std(0x8a3b2a,0.8,0,{side:THREE.DoubleSide});
  G.add(box(16,12,22,m,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(16.5,11,22.4);r.position.set(0,12,0);G.add(r);
  for(const s of [-1,1]){const gb=voluteGable(16,13,std(0xf3ead8,0.9),1);gb.position.set(0,12,s*11.2);G.add(gb);}
  G.add(box(3,4,0.6,std(0x6b4a2e),0,0,11.3));addAt(G,p,ry,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:13,hz:13});landmarkLabel('Schwörhaus',p,30);}
function buildBibliothek(){const p=placeFree(9.9930,48.3966,16,16,0),G=new THREE.Group(),gl=new THREE.MeshStandardMaterial({map:canvasTex(256,256,(x,w,h)=>{x.fillStyle='#7fb6d6';x.fillRect(0,0,w,h);
    x.strokeStyle='#e8f2f8';x.lineWidth=3;for(let i=0;i<=w;i+=21){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(w,i);x.stroke();}
    x.fillStyle='rgba(255,255,255,.35)';x.fillRect(0,0,w,h*0.3);},true),roughness:0.15,metalness:0.3});
  const py=new THREE.Mesh(new THREE.ConeGeometry(29/Math.SQRT2,36,4,1),gl);py.rotation.y=Math.PI/4;py.position.y=18;G.add(py);
  addAt(G,p,0,0);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:17,hz:17});landmarkLabel('Stadtbibliothek',p,42);}
function buildTheater(){const p=placeFree(9.9866,48.4015,30,22,0.3),G=new THREE.Group(),c=std(0xcfcac0,0.9),gl=std(0x45596b,0.2,0.4);
  for(let k=0;k<3;k++){const h=new THREE.Mesh(new THREE.CylinderGeometry(15-k*2,15-k*2,8+k*5,6),c);h.position.set(-18+k*16,(8+k*5)/2,(k%2)*8);G.add(h);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(15.2-k*2,15.2-k*2,2.2,6),gl);band.position.set(-18+k*16,4,(k%2)*8);G.add(band);}
  G.add(box(16,24,16,c,18,0,0));addAt(G,p,0.3,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:36,hz:26});landmarkLabel('Theater Ulm',p,30);}
function buildZeughaus(){const ry=0.2,p=placeFree(10.001133,48.400734,26,9,ry),G=new THREE.Group(),m=new THREE.MeshStandardMaterial({map:plasterTex('#e7c79a','#c79f6a','#41505e'),roughness:0.9}),roof=std(0x7a4030,0.8,0,{side:THREE.DoubleSide});
  m.map.repeat.set(3,1);G.add(box(52,14,16,m,0,0,0));const r2=new THREE.Mesh(gableGeo(),roof);r2.scale.set(16.6,9,52.6);r2.rotation.y=Math.PI/2;r2.position.set(0,14,0);G.add(r2);
  G.add(box(6,7,0.8,std(0xb08a5a),0,0,8.2));addAt(G,p,ry,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:28,hz:28});landmarkLabel('Zeughaus',p,28);}
function buildStadion(){const ry=0.15,p=placeFree(10.00972,48.40444,62,46,ry),G=new THREE.Group(),con=std(0xd6d2ca,0.9),seat=std(0xc8102e,0.7),grass=std(0x4caf50,1),roof=std(0xf2f2f2,0.6);
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(68,105),new THREE.MeshStandardMaterial({map:canvasTex(128,256,(x,w,h)=>{for(let i=0;i<12;i++){x.fillStyle=i%2?'#4caf50':'#43a047';x.fillRect(0,i*h/12,w,h/12);}
    x.strokeStyle='#fff';x.lineWidth=2;x.strokeRect(4,4,w-8,h-8);x.beginPath();x.moveTo(4,h/2);x.lineTo(w-4,h/2);x.stroke();x.beginPath();x.arc(w/2,h/2,14,0,7);x.stroke();x.strokeRect(w*0.25,4,w*0.5,30);x.strokeRect(w*0.25,h-34,w*0.5,30);},false),roughness:1}));
  pitch.rotation.x=-Math.PI/2;pitch.position.y=0.25;G.add(pitch);
  // Tribünen: Haupttribüne mit Dach, Gegengerade und Kurve (hufeisenförmig)
  const stand=(len,dep,h,x,z,rot,withRoof)=>{const g=new THREE.Group();for(let k=0;k<4;k++){const b=box(len,h*(k+1)/4,dep/4,k%2?seat:con,0,0,-dep/2+dep/8+k*dep/4);g.add(b);}
    if(withRoof){const r=box(len,0.8,dep+4,roof,0,h+4,0);g.add(r);for(let i=-2;i<=2;i++)g.add(box(0.6,h+4,0.6,con,i*len/5,0,-dep/2-1));}
    g.position.set(x,0,z);g.rotation.y=rot;G.add(g);};
  stand(105,14,12,-48,0,-Math.PI/2,true);stand(105,12,9,48,0,Math.PI/2,false);stand(70,12,8,0,62,0,false);
  for(const [x,z] of [[-44,-60],[44,-60],[-44,60],[44,60]]){G.add(box(1.2,34,1.2,con,x,0,z));G.add(box(6,3,1,std(0xffffff,0.3,0,{emissive:0xfff3c4,emissiveIntensity:0.6}),x,34,z));}
  addAt(G,p,ry,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:70,hz:70});landmarkLabel('Donaustadion',p,40);}
function buildJohannBaptist(){const ry=-0.3,p=placeFree(10.000386,48.394978,22,12,ry),G=new THREE.Group(),st=new THREE.MeshStandardMaterial({map:canvasTex(128,128,(x,w,h)=>{x.fillStyle='#b9a68a';x.fillRect(0,0,w,h);
    for(let r=0;r<16;r++)for(let k=0;k<8;k++){const v=Math.random()*40-20;x.fillStyle=`rgb(${170+v},${140+v},${110+v})`;x.fillRect(k*16+(r%2)*8,r*8,15,7);}},true),roughness:0.95}),roof=std(0x7a4b36,0.8,0,{side:THREE.DoubleSide});
  st.map.repeat.set(4,3);G.add(box(46,18,22,st,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(22.6,12,46.4);r.rotation.y=Math.PI/2;r.position.set(0,18,0);G.add(r);
  G.add(box(11,42,11,st,-28,0,0));const sp=spire(8.2,16,roof,4);sp.rotation.y=Math.PI/4;sp.position.set(-28,42,0);G.add(sp);
  addAt(G,p,ry,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:30,hz:30});landmarkLabel('St. Johann Baptist (Neu-Ulm)',p,64);}
// Barockes Kloster: Kirche mit Zwiebelturm, dahinter Konventbau mit Innenhof (Wiblingen, Oberelchingen)
function buildKloster(p,o){const G=new THREE.Group(),wall=new THREE.MeshStandardMaterial({map:plasterTex('#f1e8d2','#e2d6bb','#5a6a7a'),roughness:0.9}),
    roof=std(0x8a3b2a,0.8,0,{side:THREE.DoubleSide}),cop=std(0x5f9e8f,0.55,0.25),gold=std(0xd4af37,0.4,0.8),white=std(0xf6f1e6,0.85);
  wall.map.repeat.set(4,2);
  // Kirche (Längsachse x, Fassade im Westen)
  const L=o.len,Wd=o.wid,H=o.h;G.add(box(L,H,Wd,wall,0,0,0));const r=new THREE.Mesh(gableGeo(),roof);r.scale.set(Wd+1,Wd*0.45,L+1);r.rotation.y=Math.PI/2;r.position.set(0,H,0);G.add(r);
  const ap=new THREE.Mesh(new THREE.CylinderGeometry(Wd*0.45,Wd*0.45,H*0.9,12,1,false,0,Math.PI),wall);ap.rotation.y=-Math.PI/2;ap.position.set(L/2,H*0.45,0);G.add(ap);
  const fac=voluteGable(Wd,H*0.5,white,1.2);fac.rotation.y=Math.PI/2;fac.position.set(-L/2-0.4,H,0);G.add(fac);
  for(const tz of o.towers){const tw=box(9,H+o.tower,9,wall,-L/2+5,0,tz);G.add(tw);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(5.2,12,10),cop);cap.scale.set(1,1.15,1);cap.position.set(-L/2+5,H+o.tower+4,tz);G.add(cap);
    const lan=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,4,8),cop);lan.position.set(-L/2+5,H+o.tower+10,tz);G.add(lan);
    const sp=spire(1.2,6,cop,8);sp.position.set(-L/2+5,H+o.tower+12,tz);G.add(sp);G.add(box(0.3,2.4,0.3,gold,-L/2+5,H+o.tower+17.5,tz));}
  // Konvent: drei Flügel um einen Hof südlich der Kirche
  if(o.convent){const c=o.convent,cw=new THREE.MeshStandardMaterial({map:plasterTex('#efe4c8','#d9caa6','#4d5d6c'),roughness:0.9}),cr=std(0x7a4030,0.8,0,{side:THREE.DoubleSide});cw.map.repeat.set(8,1);
    for(const [x,z,w,d] of [[0,Wd/2+c/2+10,L,14],[-L/2+7,Wd/2+c/2+3,14,c],[L/2-7,Wd/2+c/2+3,14,c]]){G.add(box(w,15,d,cw,x,0,z));const rr=new THREE.Mesh(gableGeo(),cr);
      if(w>d){rr.scale.set(d+1,7,w+1);rr.rotation.y=Math.PI/2;}else rr.scale.set(w+1,7,d+1);rr.position.set(x,15,z);G.add(rr);}}
  addAt(G,p,o.ry||0,-0.5);landmarkLabel(o.name,p,H+o.tower+24);return G;}
function buildMaritim(){const ry=0.55,p=placeFree(10.0012,48.3992,40,26,ry),G=new THREE.Group(),w=std(0xeef0f2,0.6),gl=std(0x355a7a,0.15,0.5),cc=std(0xd9d6cf,0.7);
  // Hotelhochhaus (ca. 17 Etagen) und Congress Centrum davor
  G.add(box(40,58,16,w,10,0,-8));for(let f=0;f<17;f++)G.add(box(40.4,1.5,16.4,gl,10,3+f*3.3,-8));G.add(box(42,2,18,cc,10,58,-8));
  G.add(box(56,12,30,cc,-6,0,14));G.add(box(56.4,8,30.4,gl,-6,2,14));G.add(box(58,1.2,32,std(0x8a8f96,0.6),-6,12,14));
  addAt(G,p,ry,-0.3);LANDMARK_FOOT.push({x:p[0],z:p[1],hx:42,hz:42});landmarkLabel('Maritim Hotel & Congress Centrum',p,66);}
function buildLandmarksUlm(){
  const P0=ULM.places,P={};for(const k in P0)P[k]=[...P0[k]];P.rathaus[1]-=31;P.hbf[0]+=103;P.albeck[0]+=30;P.albeck[1]-=66;
  buildMuenster(P.muenster);buildGeorg(P.georg);buildPaulus(P.paulus);buildRathaus(P.rathaus);buildStadthaus(P.stadthaus);
  buildMetzgerturm(P.metzgerturm);buildSchiefesHaus(P.schiefeshaus);buildHbf(P.hbf);buildWilhelmsburg(P.wilhelmsburg);
  buildFort(P.kuhberg,62,'Fort Oberer Kuhberg');buildFort(P.albeck,52,'Fort Albeck');buildUni(P.uni);
  buildCityWall();buildBridges();buildVisualRoads();
  buildKornhaus();buildSchwoerhaus();buildBibliothek();buildTheater();buildZeughaus();buildStadion();buildJohannBaptist();buildMaritim();
  // Klöster und Orte entlang der Umland-Routen (nur wenn im Bereich der gefahrenen Route)
  const inA=q=>q&&q[0]>ULM.area.x0+300&&q[0]<ULM.area.x1-300&&q[1]>ULM.area.z0+300&&q[1]<ULM.area.z1-300;
  if(inA(P.wiblingen))buildKloster(P.wiblingen,{name:'Kloster Wiblingen',len:62,wid:24,h:24,tower:22,towers:[-8,8],convent:70,ry:0});
  if(inA(P.elchingen))buildKloster(P.elchingen,{name:'Kloster Oberelchingen',len:56,wid:22,h:22,tower:34,towers:[0],convent:0,ry:0.1});
  ulmZone(0,0);for(const zn of ZONEXY)if(zn.n&&inA([zn.x,zn.z]))mapLabel(zn.n,zn.x,zn.z,'lm');
  if(OSM.data)OSM.built=buildOsmBuildings();
  const n=buildCityUlm();console.log('Gebäude',n);
  landmarkLabel('Ulmer Münster · 161,5 m',P.muenster,172);landmarkLabel('St. Georg',P.georg,94);landmarkLabel('Pauluskirche',P.paulus,58);
  landmarkLabel('Rathaus',P.rathaus,38);landmarkLabel('Hauptbahnhof',P.hbf,24);landmarkLabel('Wilhelmsburg',P.wilhelmsburg,40);
  landmarkLabel('Fort Oberer Kuhberg',P.kuhberg,22);landmarkLabel('Fort Albeck',P.albeck,20);landmarkLabel('Universität Ulm',P.uni,28);
  landmarkLabel('Metzgerturm',P.metzgerturm,44);landmarkLabel('Stadthaus',P.stadthaus,24);{const rp=ULM.river.reduce((b,p)=>Math.hypot(p[0]-260,p[1]-300)<Math.hypot(b[0]-260,b[1]-300)?p:b);landmarkLabel('Donau',rp,10);}
  // Start/Ziel und Bergwertungen
  makeArch(12,'START · ZIEL · MÜNSTER','#1f6fd1');
  climbArches();
}
function buildVegetationUlm(){
  const fol=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9}),hi=S.quality==='high';
  const A=ULM.area,X0=A.x0+1100,X1=A.x1-1100,Z0=A.z0+1100,Z1=A.z1-1100,K=clamp((X1-X0)*(Z1-Z0)/(11869*9367),1,1.7); // größere Fläche → etwas mehr Bäume
  const free=(x,z,road)=>!nearestRoad(x,z,road)&&!nearVRoad(x,z,road-2)&&riverDist(x,z).d>RIVER_HW+6&&footFree(x,z,6);
  // Wälder an Hängen und in Parks, Einzelbäume in Vierteln
  const pick=(conif)=>()=>{const x=rnd(X0,X1),z=rnd(Z0,Z1),ny=slopeY(x,z),zn=ulmZone(x,z);let p=0;
    if(ny<0.93)p+=0.75;for(const nb of NOBXY){if(Math.hypot(x-nb.x,z-nb.z)<nb.r)p+=0.9;}
    if(riverDist(x,z).d<RIVER_HW+70)p+=0.6;if(zn.t)p*=0.25+0.4*(1-zn.d);else p+=0.06;
    if(Math.random()>p)return null;if(!free(x,z,9))return null;if(zn.d>0.25&&Math.random()<0.8)return null;
    if(conif&&ulmHeight(x,z)<70&&Math.random()<0.7)return null;return [x,z,rnd(0.8,1.6)];};
  scatter(broadGeo(),fol,Math.round((hi?9000:5000)*K),pick(false));
  scatter(coniferGeo(),fol,Math.round((hi?3500:2000)*K),pick(true));
  scatter(bushGeo(),fol,Math.round((hi?5000:2500)*K),()=>{const x=rnd(X0,X1),z=rnd(Z0,Z1);if(!free(x,z,6.5))return null;const zn=ulmZone(x,z);if(zn.d>0.5&&Math.random()<0.85)return null;return [x,z,rnd(0.6,1.4)];});
  // Straßenbäume entlang der Strecke in der Stadt
  scatter(broadGeo(),fol,hi?1600:900,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(8.5,11),[x,z]=lateralPoint(i,off);
    if(!free(x,z,8)||riverDist(x,z).d<RIVER_HW+10)return null;return [x,z,rnd(0.7,1.05)];});
  GRASS_CHUNKS.push(...scatter(grassGeo(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),hi?16000:6000,()=>{const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(5.2,24),[x,z]=lateralPoint(i,off);
    if(ulmZone(x,z).d>0.35||nearestRoad(x,z,5)||nearVRoad(x,z,4)||riverDist(x,z).d<RIVER_HW+26)return null;return [x,z,rnd(0.8,1.6)];},{shadow:false,sink:0.05}));
}
function buildSkyExtrasUlm(){ // Horizont: Schwäbische Alb im Norden/Westen, flaches Iller-/Donautal im Süden, ganz fern die Alpen
  const R=13800,n=480,pos=[],col=[],idx=[],rng=mulberry32(77);const ph=[rng()*6,rng()*6,rng()*6,rng()*6];
  const lo=HORIZON.clone(),hi=new THREE.Color(0x9fb3b3).lerp(HORIZON,0.62),snow=new THREE.Color(0xf4f7fa).lerp(HORIZON,0.35),alpLo=new THREE.Color(0x9fb0c4).lerp(HORIZON,0.55);
  for(let k=0;k<=n;k++){const a=k/n*Math.PI*2,x=Math.cos(a),z=Math.sin(a);
    // Richtung: z<0 = Norden (Alb), z>0 = Süden
    const north=sstep((-z+0.15)/0.9),south=sstep((z-0.55)/0.4);
    let h=60+north*(260+110*Math.sin(a*7+ph[0])+70*Math.sin(a*17+ph[1])+35*Math.sin(a*41+ph[2]))+(1-north)*(40*Math.sin(a*11+ph[3])+25);
    // Alpen: ganz flach und fern, nur im Süden (Allgäu)
    const alp=south*Math.max(0,Math.abs(Math.sin(a*29+ph[2]))*260+Math.sin(a*63)*60-40);
    const top=Math.max(h,alp*0.9+40);
    pos.push(x*R,-40,z*R, x*R,top,z*R);
    const c=alp*0.9+40>h?alpLo.clone().lerp(snow,sstep((alp-120)/120)):hi;
    col.push(lo.r,lo.g,lo.b,c.r,c.g,c.b);
    if(k<n){const b=k*2;idx.push(b,b+2,b+1,b+1,b+2,b+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide}));m.frustumCulled=false;
  m.onBeforeRender=()=>{m.position.set(camera.position.x,0,camera.position.z);};scene.add(m);}

/* ================= Fahrer-Modelle ================= */
function textSprite(t){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.font='600 30px Fredoka,system-ui,sans-serif';const tw=Math.min(240,x.measureText(t).width+34),x0=128-tw/2,x1=128+tw/2,r=14;
  x.fillStyle='#fffaf0';x.strokeStyle='#1e0f3a';x.lineWidth=5;x.beginPath();x.moveTo(x0+r,6);x.arcTo(x1,6,x1,58,r);x.arcTo(x1,58,x0,58,r);x.arcTo(x0,58,x0,6,r);x.arcTo(x0,6,x1,6,r);x.closePath();x.fill();x.stroke();
  x.fillStyle='#1e0f3a';x.textAlign='center';x.textBaseline='middle';x.fillText(t,128,34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthWrite:false}));s.scale.set(1.3,0.33,1);return s;}
// Fahrer und Rennrad als EIN Mesh mit Knochen (SkinnedMesh): jedes Teil hängt starr an einem Knochen, so braucht ein
// Fahrer samt Rad nur einen Zeichenaufruf (vorher 14) und kann trotzdem viel feiner gebaut sein.
// Koordinaten: Ursprung am Boden unter dem Tretlager, +z = Fahrtrichtung, +y = oben, rechte Seite des Fahrers = −x.
const RB={bike:0,crank:1,wR:2,wF:3,torso:4,head:5,uaL:6,faL:7,uaR:8,faR:9,thL:10,shL:11,ftL:12,thR:13,shR:14,ftR:15};
const RIG={BB:new THREE.Vector3(0,0.27,0),RA:new THREE.Vector3(0,0.335,-0.405),FA:new THREE.Vector3(0,0.335,0.585),
  thigh:0.44,shin:0.44,ua:0.29,fa:0.27,torso:0.56,crank:0.17};
function rgHex(c){return new THREE.Color(c);}
// Teil = Geometrie (beliebig) + Farbe (Hex oder Funktion (x,y,z)→Hex) + Knochen
function rPart(list,geo,col,bone){const g=geo.index?geo.toNonIndexed():geo;if(!g.attributes.normal)g.computeVertexNormals();list.push({g,col,bone});}
function rTube(a,b,r,seg=7){return tube(a,b,r,seg);}
// Glied entlang +y von 0 bis len, Radius r0→r1, mit Ringen für Farbbänder
function rLimb(len,r0,r1,seg=9,rings=4){const g=new THREE.CylinderGeometry(r1,r0,len,seg,rings,false);g.translate(0,len/2,0);return g;}
function rLathe(prof,seg){return new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(r,y)),seg);}
// Farbbänder mit harten Kanten: je Band ein eigenes Stück (sonst verlaufen die Farben über die Dreiecke)
function rRadius(prof,y){for(let i=0;i<prof.length-1;i++){const [r0,y0]=prof[i],[r1,y1]=prof[i+1];if(y>=y0&&y<=y1)return r0+(r1-r0)*(y-y0)/Math.max(1e-6,y1-y0);}return y<prof[0][1]?prof[0][0]:prof[prof.length-1][0];}
function rLatheBands(list,prof,seg,bands,bone,sx=1,sz=1){for(const [y0,y1,col] of bands){const P=[[rRadius(prof,y0),y0]];for(const q of prof)if(q[1]>y0&&q[1]<y1)P.push(q);P.push([rRadius(prof,y1),y1]);
    const g=rLathe(P,seg);if(sx!==1||sz!==1){g.scale(sx,1,sz);g.computeVertexNormals();}rPart(list,g,col,bone);}}
function rLimbBands(list,len,r0,r1,seg,bands,bone){rLatheBands(list,[[r0,0],[r1,len]],seg,bands.map(([a,b,c])=>[a,b,c]),bone);
  const cap=new THREE.CircleGeometry(r1,seg);cap.rotateX(-Math.PI/2);cap.translate(0,len,0);rPart(list,cap,bands[bands.length-1][2],bone);}
function rBuild(parts){let n=0;for(const p of parts)n+=p.g.attributes.position.count;
  const P=new Float32Array(n*3),Nn=new Float32Array(n*3),C=new Float32Array(n*3),SI=new Uint16Array(n*4),SW=new Float32Array(n*4),c=new THREE.Color();let o=0;
  for(const p of parts){const pa=p.g.attributes.position,na=p.g.attributes.normal,cnt=pa.count,fn=typeof p.col==='function';if(!fn)c.set(p.col);
    P.set(pa.array,o*3);Nn.set(na.array,o*3);
    for(let i=0;i<cnt;i++){if(fn)c.set(p.col(pa.getX(i),pa.getY(i),pa.getZ(i)));const k=o+i;C[k*3]=c.r;C[k*3+1]=c.g;C[k*3+2]=c.b;SI[k*4]=p.bone;SW[k*4]=1;}o+=cnt;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nn,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(SW,4));
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0.9,0.1),1.6);return g;}
// Rad (Knochen in der Nabe, Achse = x): Hochprofilfelge, Reifen, Nabe, Speichen, beim Hinterrad Kassette
function rWheel(parts,bone,rear,rimCol,tireSide){const lo=S.quality==='low',ns=lo?12:20,ts=lo?24:36;
  const rim=rLathe([[0.3225,-0.0105],[0.305,-0.0125],[0.29,-0.008],[0.284,0],[0.29,0.008],[0.305,0.0125],[0.3225,0.0105]],ts);rim.rotateZ(Math.PI/2);
  rPart(parts,rim,(x,y,z)=>{const r=Math.hypot(y,z);return r>0.297&&r<0.309&&Math.abs(x)>0.009?rimCol:0x1b1c1f;},bone);
  const tire=new THREE.TorusGeometry(0.3235,0.0125,lo?5:6,ts);tire.rotateY(Math.PI/2);
  rPart(parts,tire,(x,y,z)=>Math.abs(x)>0.007&&Math.hypot(y,z)<0.324?tireSide:0x18181a,bone);
  const hub=new THREE.CylinderGeometry(0.019,0.019,0.1,10);hub.rotateZ(Math.PI/2);rPart(parts,hub,0xa9adb3,bone);
  for(let k=0;k<ns;k++){const a=k/ns*Math.PI*2,s=k%2?1:-1;rPart(parts,tube([s*0.028,Math.cos(a)*0.024,Math.sin(a)*0.024],[0,Math.cos(a+0.05)*0.285,Math.sin(a+0.05)*0.285],0.0016,3),0x2a2c30,bone);}
  if(rear)for(let k=0;k<7;k++){const d=new THREE.CylinderGeometry(0.026+k*0.0045,0.026+k*0.0045,0.0035,18);d.rotateZ(Math.PI/2);d.translate(-0.022-k*0.0055,0,0);rPart(parts,d,0x9aa0a6,bone);}}
function makeRider(jersey,label,frameCol,opts={}){
  const g=new THREE.Group(),parts=[],fc=frameCol||0x20232a,jc=rgHex(jersey),lum=jc.r*0.3+jc.g*0.59+jc.b*0.11;
  const acc=jc.clone().lerp(new THREE.Color(lum>0.55?0x1e0f3a:0xffffff),lum>0.55?0.45:0.6).getHex(),jer=jc.getHex();
  const h=[...(label||'Du')].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7),skins=[0xe8b896,0xd9a27c,0xb97d55,0x7f5236,0xf0c8a8,0xe0ac88];
  const skin=opts.skin||(label?skins[h%skins.length]:0xe0ac88),helmet=opts.helmet||(h%3===0?0xf4f4f2:h%3===1?fc:jer),shoe=h%2?0xf2f2f2:0x1d1e22,sock=h%4===1?0x1d1e22:0xf4f4f2;
  const B=RIG.BB,RA=RIG.RA,FA=RIG.FA,v=(x,y,z)=>[x,y,z];
  // ---- Rahmen & Anbauteile (Knochen bike) ----
  const SC=v(0,0.80,-0.165),HT=v(0,0.845,0.447),HB=v(0,0.705,0.48),bb=[B.x,B.y,B.z],ra=[RA.x,RA.y,RA.z],fa=[FA.x,FA.y,FA.z];
  const F=(geo,c)=>rPart(parts,geo,c,RB.bike);
  F(rTube(bb,HB,0.026,9),fc);F(rTube(SC,HT,0.018,8),fc);F(rTube(bb,SC,0.02,8),fc);F(rTube(HB,HT,0.025,10),fc);
  for(const s of [1,-1]){F(rTube([s*0.02,0.27,-0.02],[s*0.058,0.335,-0.405],0.011,6),fc);F(rTube([s*0.018,0.785,-0.18],[s*0.058,0.335,-0.405],0.0085,6),fc);
    F(rTube([s*0.03,0.69,0.487],[s*0.05,0.335,0.585],0.012,6),fc);}
  F(rTube([0,0.705,0.48],[0,0.67,0.49],0.03,8),fc); // Gabelkrone
  {const sb=new THREE.SphereGeometry(0.03,10,8);sb.translate(0,0.27,0);F(sb,0x2a2c30);} // Tretlager
  F(rTube(SC,[0,0.935,-0.21],0.0135,8),0x2a2c30); // Sattelstütze
  {const sd=new THREE.BoxGeometry(0.14,0.035,0.27,4,1,6),p=sd.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i),t=(z+0.135)/0.27;p.setX(i,p.getX(i)*(1-0.68*sstep((t-0.25)/0.6)));p.setY(i,p.getY(i)-Math.pow(p.getX(i)/0.07,2)*0.006+t*0.004);}
    sd.computeVertexNormals();sd.translate(0,0.957,-0.215);F(sd,(x,y,z)=>Math.abs(x)>0.045&&z<-0.17?acc:0x151618);}
  F(rTube(HT,[0,0.87,0.452],0.016,8),0x2a2c30);F(rTube([0,0.87,0.452],[0,0.884,0.56],0.016,8),0x2a2c30); // Spacer, Vorbau
  F(rTube([-0.2,0.884,0.56],[0.2,0.884,0.56],0.0125,8),0x26282c);
  for(const s of [1,-1]){const cv=new THREE.CatmullRomCurve3([[s*0.2,0.884,0.56],[s*0.206,0.884,0.615],[s*0.21,0.865,0.66],[s*0.212,0.81,0.668],[s*0.21,0.772,0.632],[s*0.209,0.772,0.58]].map(q=>new THREE.Vector3(...q)));
    F(new THREE.TubeGeometry(cv,14,0.0125,6,false),0x141517);
    const hood=new THREE.BoxGeometry(0.03,0.048,0.075);hood.rotateX(-0.35);hood.translate(s*0.206,0.902,0.632);F(hood,0x18191b);
    F(rTube([s*0.207,0.885,0.655],[s*0.212,0.79,0.685],0.0065,5),0x4a4d52);}
  {const comp=new THREE.BoxGeometry(0.05,0.012,0.075);comp.translate(0,0.9,0.6);F(comp,0x1b1c1f);}
  // Flaschen am Unter- und Sattelrohr
  for(const [a,b2,o,c] of [[bb,HB,[0,0.048,0.012],h%2?0xf4f4f2:jer],[bb,SC,[0,0.01,0.05],0x2a2c30]]){const A=new THREE.Vector3(...a),Bv=new THREE.Vector3(...b2),d=Bv.clone().sub(A),m=A.clone().addScaledVector(d,0.42).add(new THREE.Vector3(...o));
    const e0=m.clone().addScaledVector(d.normalize(),-0.1),e1=m.clone().addScaledVector(d,0.1);F(rTube(e0.toArray(),e1.toArray(),0.034,10),c);F(rTube(e1.toArray(),e1.clone().addScaledVector(d,0.03).toArray(),0.014,6),0x222222);}
  // Antrieb (Kette, Schaltwerk, Umwerfer) auf der rechten Seite (−x)
  F(rTube([-0.068,0.372,0],[-0.05,0.39,-0.405],0.0045,4),0x5d6066);F(rTube([-0.068,0.17,0],[-0.05,0.2,-0.39],0.0045,4),0x5d6066);
  {const rd=new THREE.BoxGeometry(0.018,0.1,0.05);rd.translate(-0.06,0.26,-0.42);F(rd,0x2a2c30);const fd=new THREE.BoxGeometry(0.015,0.05,0.06);fd.translate(-0.045,0.39,-0.05);F(fd,0x2a2c30);}
  for(const [y,z] of [[0.66,0.505],[0.79,-0.2]]){const br=new THREE.BoxGeometry(0.08,0.03,0.03);br.translate(0,y,z);F(br,0x2a2c30);}
  // ---- Kurbel (dreht sich, Knochen crank, Ursprung im Tretlager) ----
  const K=(geo,c)=>rPart(parts,geo,c,RB.crank);
  for(const [r,c] of [[0.104,0x2c2e33],[0.074,0x6c7077]]){const d=new THREE.CylinderGeometry(r,r,0.004,30);d.rotateZ(Math.PI/2);d.translate(-0.07,0,0);K(d,c);}
  K(rTube([-0.084,0,0],[-0.084,-RIG.crank,0],0.012,6),0x2a2c30);K(rTube([0.084,0,0],[0.084,RIG.crank,0],0.012,6),0x2a2c30);K(rTube([-0.084,0,0],[0.084,0,0],0.012,6),0x8d9298);
  // ---- Räder ----
  const rimCol=h%3===0?0xd8dce0:acc;rWheel(parts,RB.wR,true,rimCol,0x1d1e21);rWheel(parts,RB.wF,false,rimCol,0x1d1e21);
  // ---- Oberkörper (Knochen torso: y = Wirbelsäule von der Hüfte aufwärts, +z = Brust/Bauch, −z = Rücken) ----
  {const TP=[[0.001,-0.07],[0.11,-0.06],[0.152,0],[0.148,0.08],[0.134,0.19],[0.138,0.29],[0.158,0.39],[0.17,0.46],[0.164,0.52],[0.12,0.565],[0.06,0.59],[0.001,0.596]];
    rLatheBands(parts,TP,S.quality==="low"?11:16,[[-0.07,0.1,0x141517],[0.1,0.37,jer],[0.37,0.425,acc],[0.425,0.565,jer],[0.565,0.596,acc]],RB.torso,1.2,0.74);
    // drei Rückentaschen und Reißverschluss
    for(const x of [-0.085,0,0.085]){const pk=new THREE.BoxGeometry(0.075,0.11,0.012);pk.translate(x,0.17,-0.108);rPart(parts,pk,jc.clone().multiplyScalar(0.8).getHex(),RB.torso);}
    {const zp=new THREE.BoxGeometry(0.008,0.44,0.006);zp.translate(0,0.36,0.118);rPart(parts,zp,acc,RB.torso);}
    for(const s of [1,-1]){const sh=new THREE.SphereGeometry(0.068,10,8);sh.scale(1,0.9,1);sh.translate(s*0.17,0.515,0.0);rPart(parts,sh,jer,RB.torso);}}
  // ---- Kopf (Knochen head, aufrecht, +z = Blickrichtung) ----
  {const H=(geo,c)=>rPart(parts,geo,c,RB.head);
    const hd=new THREE.SphereGeometry(0.1,14,12);hd.scale(0.88,1.02,1.04);H(hd,skin);
    for(const s of [1,-1]){const e=new THREE.SphereGeometry(0.018,6,5);e.scale(0.5,1,0.8);e.translate(s*0.088,-0.005,0);H(e,skin);}
    H(rTube([0,-0.05,-0.03],[0,-0.16,-0.11],0.046,8),skin);
    const hm=new THREE.SphereGeometry(0.117,16,9,0,Math.PI*2,0,Math.PI*0.53);hm.scale(0.98,0.95,1.27);hm.rotateX(-0.28);hm.translate(0,0.022,-0.018);H(hm,helmet);
    const pad=new THREE.SphereGeometry(0.106,12,7,0,Math.PI*2,0,Math.PI*0.53);pad.scale(0.95,0.95,1.12);pad.rotateX(-0.28);pad.translate(0,0.018,-0.012);H(pad,0x232428);
    {const hr=new THREE.SphereGeometry(0.104,12,8,Math.PI*1.05,Math.PI*0.9,Math.PI*0.3,Math.PI*0.34);hr.scale(0.9,1.02,1.06);H(hr,opts.hair||[0x3b2a1e,0x6b4a2b,0x1e1a17,0xa07a4a][h%4]);}
    {const ns=new THREE.ConeGeometry(0.014,0.035,5);ns.rotateX(Math.PI/2);ns.translate(0,-0.025,0.108);H(ns,skin);}
    for(const x of [-0.045,0,0.045]){const vt=new THREE.BoxGeometry(0.014,0.01,0.15);vt.rotateX(-0.05);vt.translate(x,0.124-Math.abs(x)*0.3,-0.02);H(vt,0x202226);}
    for(const s of [1,-1])H(rTube([s*0.092,0.01,0.0],[s*0.07,-0.09,0.03],0.005,4),0x202226);
    const gl=new THREE.TorusGeometry(0.093,0.013,5,14,Math.PI*0.72);gl.rotateX(Math.PI/2);gl.rotateY(-Math.PI*0.14);gl.scale(0.96,0.9,1.07);gl.translate(0,0.0,0.004);
    H(gl,(x,y,z)=>z>0.06?(h%2?0x2b4c7e:0x6b3a1f):0x18191b);
    if(opts.pony){H(rTube([0,0.0,-0.115],[0,-0.13,-0.17],0.026,7),opts.hair||0x5a3b22);}}
  // ---- Arme ----
  for(const [ua,fa] of [[RB.uaL,RB.faL],[RB.uaR,RB.faR]]){
    rLimbBands(parts,RIG.ua,0.05,0.041,9,[[0,0.15,jer],[0.15,0.17,acc],[0.17,RIG.ua,skin]],ua);
    {const e=new THREE.SphereGeometry(0.042,8,6);rPart(parts,e,skin,fa);}
    rLimbBands(parts,RIG.fa,0.04,0.031,8,[[0,0.215,skin],[0.215,RIG.fa,0x1d1e22]],fa);
    const hand=new THREE.BoxGeometry(0.05,0.085,0.04);hand.translate(0,RIG.fa+0.035,0);rPart(parts,hand,0x1d1e22,fa);}
  // ---- Beine ----
  for(const [th,sh,ft] of [[RB.thL,RB.shL,RB.ftL],[RB.thR,RB.shR,RB.ftR]]){
    rLimbBands(parts,RIG.thigh,0.08,0.056,10,[[0,0.33,0x141517],[0.33,0.355,acc],[0.355,RIG.thigh,skin]],th);
    const kn=new THREE.SphereGeometry(0.052,9,7);rPart(parts,kn,skin,sh);
    rLatheBands(parts,[[0.05,0],[0.056,0.06],[0.061,0.13],[0.053,0.24],[0.041,0.33],[0.035,0.4],[0.034,0.44],[0.001,0.445]],10,[[0,0.35,skin],[0.35,0.445,sock]],sh);
    // Schuh: Ursprung = Pedalachse unter dem Fußballen
    const sh2=new THREE.BoxGeometry(0.094,0.07,0.27,2,2,4),p=sh2.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i);if(z>0.05)p.setX(i,p.getX(i)*(1-(z-0.05)*2.2));if(z>0.07&&p.getY(i)>0)p.setY(i,p.getY(i)-(z-0.07)*0.25);}
    sh2.computeVertexNormals();sh2.translate(0,0.05,-0.04);rPart(parts,sh2,(x,y,z)=>y<0.02?0x1d1e22:Math.abs(x)>0.03&&y>0.06&&z>-0.08&&z<0.02?acc:shoe,ft);
    const pd=new THREE.BoxGeometry(0.075,0.02,0.09);pd.translate(0,-0.002,0);rPart(parts,pd,0x1b1c1f,ft);}
  // ---- zusammensetzen ----
  const geo=rBuild(parts),bones=[];for(let i=0;i<16;i++){const b=new THREE.Bone();b.matrixAutoUpdate=false;bones.push(b);}
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0.08});mat.skinning=true;
  const mesh=new THREE.SkinnedMesh(geo,mat);for(const b of bones)mesh.add(b);mesh.bind(new THREE.Skeleton(bones),new THREE.Matrix4());
  mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  g.userData={mesh,bones,stand:0,tuck:0,lean:0,t:0,seed:(h%1000)/100};
  animRider(g,0,0);
  if(label){const sp=textSprite(label);sp.position.y=2.05;g.add(sp);g.userData.label=sp;}
  scene.add(g);return g;}
const _rm=new THREE.Matrix4(),_rb=new THREE.Matrix4(),_rx=new THREE.Vector3(),_ry=new THREE.Vector3(),_rz=new THREE.Vector3(),_ra=new THREE.Vector3(),_rk=new THREE.Vector3(),
  _rh=new THREE.Vector3(),_rs=new THREE.Vector3(),_rt=new THREE.Vector3(),_rq=new THREE.Vector3(),_rw=new THREE.Vector3(),_rp=new THREE.Vector3(),_rf=new THREE.Matrix4();
// Knochenmatrix aus Startpunkt a, Achsrichtung (y) zum Punkt b und einer Seitenrichtung side (≈ x)
function rBoneTo(bone,M,a,b,side){_ry.subVectors(b,a).normalize();_rz.crossVectors(side,_ry).normalize();_rx.crossVectors(_ry,_rz);
  bone.matrix.makeBasis(_rx,_ry,_rz).setPosition(a).premultiply(M);bone.matrixWorldNeedsUpdate=true;}
function ikKnee(hip,foot,l1,l2,bend,out){const d=_rq.subVectors(foot,hip),L=Math.min(d.length(),l1+l2-1e-3);d.normalize();
  const c=clamp((l1*l1+L*L-l2*l2)/(2*l1*L),-1,1),s=Math.sqrt(1-c*c);_rw.copy(bend).addScaledVector(d,-bend.dot(d)).normalize();
  return out.copy(hip).addScaledVector(d,c*l1).addScaledVector(_rw,s*l1);}
const RX1=new THREE.Vector3(1,0,0),BEND_LEG=new THREE.Vector3(0,0.1,1),BEND_ARM=new THREE.Vector3(0,-0.35,-1);
// st: {v (m/s), w (W/kg), g (Steigung), ped (tritt)} – daraus Haltung: sitzen, Wiegetritt (steil/Sprint), Abfahrtshaltung
function animRider(o,phase,wheelAng,st){const u=o.userData,b=u.bones,now=performance.now()/1000,dt=Math.min(0.2,u.t?now-u.t:0);u.t=now;
  if(st){const tS=(st.w>8.5||(st.g>0.075&&st.w>3.0&&Math.sin(now*0.11+u.seed*3)>-0.1))&&st.v>1.2?1:0,tT=st.v>12.5&&st.w<1.2&&st.g<-0.02?1:0;
    u.stand+=(tS-u.stand)*Math.min(1,dt*2.2);u.tuck+=(tT-u.tuck)*Math.min(1,dt*1.5);}
  const S1=u.stand,T1=u.tuck*(1-S1),rock=S1*0.12*Math.sin(phase),sway=S1*0.025*Math.sin(phase);
  // Rad (ganz) im Wiegetritt seitlich kippen
  _rb.makeRotationZ(rock);
  b[RB.bike].matrix.copy(_rb);
  b[RB.crank].matrix.makeRotationX(-phase).setPosition(RIG.BB).premultiply(_rb);
  b[RB.wR].matrix.makeRotationX(-wheelAng).setPosition(RIG.RA).premultiply(_rb);
  b[RB.wF].matrix.makeRotationX(-wheelAng).setPosition(RIG.FA).premultiply(_rb);
  // Hüfte und Oberkörper
  const bob=0.005*Math.sin(phase*2)*(1-S1);
  _rh.set(sway,0.985+0.095*S1-0.02*T1+bob,-0.195+0.17*S1+0.02*T1);
  const th=(38+8*S1-16*T1)*Math.PI/180,roll=-rock*0.7+0.03*Math.sin(phase)*(1-S1);
  _rs.set(_rh.x,_rh.y+Math.sin(th)*RIG.torso,_rh.z+Math.cos(th)*RIG.torso);
  _rt.set(Math.cos(roll),Math.sin(roll),0);rBoneTo(b[RB.torso],_rb,_rh,_rs,_rt);
  const hp=_rp.set(_rs.x,_rs.y+0.13-0.04*T1,_rs.z+0.1+0.02*T1);b[RB.head].matrix.makeRotationX(0.12-0.25*T1+0.15*S1).setPosition(hp).premultiply(_rb);
  // Arme: Schulter → Hände an den Bremsgriffen (Abfahrt: im Unterlenker)
  const tm=b[RB.torso].matrix;
  for(const [s,ua,fa] of [[1,RB.uaL,RB.faL],[-1,RB.uaR,RB.faR]]){
    const sh=_ra.set(s*0.17,0.515,0).applyMatrix4(_rf.copy(_rb).invert().multiply(tm));
    const hand=_rk.set(s*0.205,0.905-0.115*T1,0.6-0.01*T1);
    const el=ikKnee(sh,hand,RIG.ua,RIG.fa,_rt.set(s*0.6,BEND_ARM.y,BEND_ARM.z),new THREE.Vector3());
    rBoneTo(b[ua],_rb,sh,el,RX1);rBoneTo(b[fa],_rb,el,hand,RX1);}
  // Beine: Pedal → Fuß (Ballen über der Achse, Knöchel dahinter) → Knie per IK
  for(const [s,th2,sh2,ft] of [[1,RB.thL,RB.shL,RB.ftL],[-1,RB.thR,RB.shR,RB.ftR]]){const ph=-phase+(s>0?0:Math.PI);
    const pd=_rp.set(s*0.12,RIG.BB.y+Math.cos(ph)*RIG.crank,Math.sin(ph)*-RIG.crank),pitch=0.15+0.2*Math.sin(ph)-0.08*Math.cos(ph);
    b[ft].matrix.makeRotationX(pitch).setPosition(pd).premultiply(_rb);
    const ank=_ra.set(0,0.085,-0.1).applyMatrix4(_rf.makeRotationX(pitch).setPosition(pd));
    const hip=_rh.clone().add(_rt.set(s*0.085,0,0)),kn=ikKnee(hip,ank,RIG.thigh,RIG.shin,BEND_LEG,new THREE.Vector3());
    rBoneTo(b[th2],_rb,hip,kn,RX1);rBoneTo(b[sh2],_rb,kn,ank,RX1);}
  for(const bn of b)bn.matrixWorldNeedsUpdate=true;}
// Fahrer auf die Straße setzen; in Kurven legt er sich je nach Tempo hinein (dir=−1: Gegenverkehr)
function placeRider(o,dist,lat,v,dir=1){const r=roadAt(dist),a=roadAt(dist+2),rx=-r.tz,rz=r.tx;
  o.position.set(r.x+rx*lat,r.h+0.25,r.z+rz*lat);o.lookAt(a.x+rx*lat,a.h+0.25,a.z+rz*lat);
  if(v){const p=roadAt(dist-3),q=roadAt(dist+3);let da=Math.atan2(q.tx,q.tz)-Math.atan2(p.tx,p.tz);da=Math.atan2(Math.sin(da),Math.cos(da));
    const tgt=-dir*clamp(Math.atan(v*v*(da/6)/9.81),-0.55,0.55),u=o.userData;u.lean+=(tgt-u.lean)*0.12;o.rotateZ(u.lean);}}
/* ================= Mitfahrer & Gegenverkehr ================= */
// Rollen: „Gruppe“ fährt mit dir (richtet sich nach deiner Leistung der letzten ~30 s und bleibt in deiner Nähe),
// „langsam“ überholst du, „schnell“ überholt dich ab und zu. Wer weit weg ist, wird außer Sicht neu eingesetzt,
// damit die Strecke nie leer wirkt. S.botMode: 'me' (fahren mit mir) | 'solo' (ohne Gruppe, nur andere Fahrer auf der
// Strecke) | 'fixed' (Gruppe mit S.botWkg) | 'off'.
const BOT_DEFS=[['Lena K.',0x2e7dd7,0xf2f2f2,'group'],['Jonas',0x2bb673,0x222222,'group'],['Aylin',0xd63aa8,0x222222,'group'],['Sven',0x7a4fd6,0xe8e8e8,'group'],
  ['Tobi',0xf2c230,0x2a4a8a,'slow'],['Marie',0x18b5c9,0x9a1e1e,'slow'],['Hanna',0xff8fb8,0x222222,'slow'],['Paul',0xe04848,0x222222,'fast'],['Emre',0x3e8fe0,0xe8e8e8,'fast']];
function initRiders(){
  player=makeRider(0xeb567b,null,0x1b1d22);
  BOTS=BOT_DEFS.map(([name,color,frame,role])=>({name,color,role,mass:60+Math.random()*22,str:role==='group'?rnd(0.93,1.07):role==='slow'?rnd(0.66,0.8):rnd(1.18,1.32),
    climb:rnd(0.88,1.12),off:rnd(-20,16),cad:rnd(82,94),dist:0,v:0,P:0,wkg:0,lat:0,latT:0,fat:0,surge:0,surgeT:rnd(60,200),seed:Math.random()*100,phase:Math.random()*6,wheel:0,active:true,
    obj:makeRider(color,name,frame,{pony:['Lena K.','Aylin','Marie','Hanna'].includes(name)})}));
  placeBotsStart();applyBotVis();initOncoming();}
// Startaufstellung relativ zu dir (auch beim Wiedereinschalten mitten in der Fahrt)
function placeBotsStart(){const gd=[-14,-7,8,15];let gk=0,sk=0,fk=0;
  for(const b of BOTS){b.P=0;b.fat=0;b.surge=0;b._sg=undefined;
    if(b.role==='group'){b.dist=S.dist+gd[gk++%4];b.v=S.v;b.lat=rnd(-0.6,2.4);}
    else if(b.role==='slow'){b.dist=S.dist+200+sk++*230+rnd(0,60);b.v=Math.max(6,S.v*0.8);b.lat=rnd(1.4,2.6);}
    else{b.dist=S.dist-170-fk++*170;b.v=Math.max(9,S.v);b.lat=rnd(-0.8,0.4);}
    b.latT=b.lat;}}
function applyBotVis(){const on=S.botMode!=='off'&&(typeof NET==='undefined'||NET.state!=='on'||$('iNetBots').checked);
  for(const b of BOTS){b.active=on&&!(S.botMode==='solo'&&b.role==='group');b.obj.visible=b.active;}}
function stepBots(dt){if(S.botMode==='off')return;
  const t=performance.now()/1000,follow=S.botMode==='me',ref=S.botMode==='fixed'?S.botWkg:S.p30/S.mass,me=S.dist,curves=(FEELS[S.feel]||FEELS.real).curves;
  for(const b of BOTS){if(!b.active)continue;const g=gradeAt(b.dist),gap=b.dist-me;let w;
    if(b.role==='group'){w=ref*b.str;
      // fährt mit dir: wer vorne wegzieht, lässt nach, wer hängt, drückt – jeder hat seinen Lieblingsplatz in der Gruppe
      if(follow)w*=clamp(1-(gap-b.off)/90,0.6,1.35);
      if(g>0.03)w*=b.climb;}
    else{w=Math.max(ref,1.8)*b.str;if(g>0.03)w*=1.08*b.climb;}
    b.fat=clamp(b.fat+dt*(g>0.04?1:-0.6)/900,0,0.15);w*=1-b.fat*(b.climb<1?1.6:0.6); // lange Anstiege machen müde
    b.surgeT-=dt;if(b.surgeT<0){b.surge=b.role==='group'&&Math.random()<0.5?rnd(12,30):0;b.surgeT=rnd(90,240);} // ab und zu eine Attacke
    if(b.surge>0){b.surge-=dt;w*=1.25;}
    w*=1+0.05*Math.sin(t*0.07+b.seed)+0.03*Math.sin(t*0.37+b.seed*2);
    const hangs=follow&&b.role==='group'&&gap<b.off-5; // wer in der Gruppe hinten hängt, tritt bergab weiter
    if(!hangs){if(g<-0.035&&b.v>11)w=0;else if(g<-0.02)w*=0.4;} // bergab rollen lassen
    let P=clamp(w*b.mass,0,b.mass*8);if(b.role==='group'&&(S.elapsed<1||(follow&&ref<0.05)))P=0; // Gruppe wartet, bis du losfährst
    b.P+=(P-b.P)*Math.min(1,dt*1.5);b.wkg=b.P/b.mass;
    b.v=advance(b.v,b.P,g,b.mass+PHYS.bike,draftFactor(b.dist,b),dt);
    if(curves)b.v=Math.min(b.v,Math.max(Math.min(curveLimit(b.dist),VCOMF),b.v-CURVE_DEC*1.4*dt));
    b.dist+=b.v*dt;b.wheel+=b.v/0.335*dt;b.phase+=(b.P>30?b.cad/60:0)*Math.PI*2*dt;
    if(Math.random()<dt*0.1)b.latT=rnd(-0.9,2.6);b.lat+=(b.latT-b.lat)*dt*0.3; // rechte Straßenhälfte
    // weit weg? außer Sicht (hinter dir bzw. weit vorne) neu einsetzen
    const gp=b.dist-me;
    if(b.role==='group'){if(follow?Math.abs(gp)>400:Math.abs(gp)>900){b.dist=me-rnd(60,100);b.v=Math.max(S.v,3);b._sg=undefined;}}
    else if(b.role==='slow'){if(gp<-250||gp>1200){b.dist=me+rnd(350,600);b.v=Math.max(S.v*0.75,4);b._sg=undefined;}}
    else if(gp>350||gp<-800){b.dist=me-rnd(200,330);b.v=Math.max(S.v*1.1,7);b._sg=undefined;}}}
// Gegenverkehr: Radfahrer auf der linken Straßenhälfte, die dir entgegenkommen
const ONC={list:[]};
function initOncoming(){ONC.list=[];const n=S.quality==='low'?3:5,cols=[0x2bb673,0xd63aa8,0xf2c230,0x18b5c9,0xe04848,0x7a4fd6];
  for(let k=0;k<n;k++){const o={obj:makeRider(cols[k%cols.length],null,k%2?0x222222:0xe8e8e8),d:0,v:0,base:7,lat:-3,phase:Math.random()*6,wheel:0};ONC.list.push(o);respawnOnc(o,k);}}
function respawnOnc(o,k){o.d=S.dist+rnd(250,750)+(k||0)*130;o.base=rnd(6.5,9.5);o.v=o.base;o.lat=rnd(-3.4,-2.6);o._sg=undefined;}
function stepOncoming(dt){const on=S.life&&S.started;
  for(const o of ONC.list){if(!on){o.obj.visible=false;continue;}
    const gOpp=-gradeAt(o.d),vT=o.base*clamp(1-6*gOpp,0.45,1.6);o.v+=(vT-o.v)*Math.min(1,dt*0.5);o.d-=o.v*dt;
    o.phase+=(gOpp<-0.03&&o.v>9?0:1.45)*Math.PI*2*dt;o.wheel+=o.v/0.335*dt;
    if(o.d<S.dist-60||o.d>S.dist+1500)respawnOnc(o);
    placeRider(o.obj,o.d,o.lat,o.v,-1);o.obj.rotateY(Math.PI);const d2=o.obj.position.distanceToSquared(camera.position);
    o.obj.visible=d2<320*320;if(d2<200*200)animRider(o.obj,o.phase,o.wheel,{v:o.v,w:2,g:-gradeAt(o.d)});}}

/* ================= Physik ================= */
function draftFactor(d,self){
  const check=o=>{const g=o-d;return g>0.6&&g<7;};
  if(self!==player&&check(S.dist))return 0.72;
  for(const b of BOTS)if(b!==self&&b.active&&check(b.dist))return 0.72;
  if(self===player&&NET.state==='on'&&netDraftCheck(d))return 0.72;return 1;}
function roadForce(v,grade,mass,draft){const th=Math.atan(grade);
  return mass*PHYS.g*(Math.sin(th)+PHYS.crr*Math.cos(th))+0.5*PHYS.rho*PHYS.cda*draft*v*v;}
function advance(v,P,grade,mass,draft,dt){
  // Lager-/Nabenreibung und bei Schritttempo zusätzliches Abbremsen (man hält irgendwann an)
  let F=roadForce(v,grade,mass,draft)+1.2;if(P<5&&v<2.2&&grade<0.01)F+=(2.2-v)*6;
  // Im sanften Modus wirkt das Rad beim Treten träger (mehr Schwung, Wellen rollt man durch) – beim Ausrollen nicht,
  // und beim Anfahren erst ab etwa 10 km/h, sonst kommt man kaum vom Fleck
  const inertia=(mass+1.5)*(P>20?1+0.8*S.smooth*sat((v-2.5)/4):1);
  const a=(P/Math.max(v,1.5)-F)/inertia;return Math.max(0,v+a*dt);}
function stepPhysics(dt){
  const now=performance.now();
  if(T.dev&&now-T.lastData>3000){S.power=0;S.cadence=0;}
  const r=roadAt(S.dist),mass=S.mass+PHYS.bike;
  if(S.sim){const tw=ergActive()?targetWatts():null;S.power=tw!==null?tw+Math.sin(now/700)*4:S.simPower;S.cadence=S.power>0?(tw!==null?88:clamp(S.v/(GEARS[S.gear]*PHYS.circ)*60,0,130)):0;}
  stepWorkout(dt);
  {const tg=GEARS[S.gear],tau=(SHIFT_FEEL[S.shiftFeel]||SHIFT_FEEL.soft).tau;if(!S.gr)S.gr=tg;
    if(Math.abs(S.gr/tg-1)>0.002){S.gr=Math.exp(Math.log(S.gr)+(Math.log(tg)-Math.log(S.gr))*(1-Math.exp(-dt/Math.max(0.01,tau))));if(now-(T.rampSend||0)>110){T.rampSend=now;sendResistance(false);}}else S.gr=tg;}
  updatePedaling(dt);const Peff=T.pedaling?S.power:0;
  if(T.startSoft>0){const vw=wheelSpeed();if(!T.pedaling||vw===null||vw<=S.v*1.05+0.3||now-T.startT>12000)T.startSoft=Math.max(0,T.startSoft-dt/1.5);}
  if(NET.hold){S.v=0;S.dist=0;S.legPhase+=S.cadence/60*Math.PI*2*dt;return;}
  {const f=FEELS[S.feel]||FEELS.real;if(f.alt)PHYS.rho=1.225*Math.exp(-((IS_ULM?UY0:0)+r.h)/8400);
    S.v=advance(S.v,Peff,gradeAt(S.dist),mass,draftFactor(S.dist,player),dt);
    // Realistisch: vor engen Kurven bremst man – vor allem bergab (draußen fährt man Abfahrten nie voll laufen)
    if(f.curves){const vc=curveLimit(S.dist),vl=Math.min(vc,VCOMF);if(S.v>vl+0.3){S.v=Math.max(vl,S.v-CURVE_DEC*1.4*dt);S.brakeT=now;
      if(vc<VCOMF&&now-(S.brakeMsg||0)>20000&&S.v>9){S.brakeMsg=now;toast('🛑 Kurve – du bremst auf '+Math.round(vl*3.6)+' km/h');}}}}
  recStep(dt);const prevD=S.dist;S.dist+=S.v*NET.rf*dt;if(Math.abs(NET.rf-1)>0.03){if(KOM.act)KOM.act.rb=true;if(LAP.act)LAP.act.rb=true;}if(S.v>0.2)S.elapsed+=dt;S.wheel+=S.v/0.335*dt;stepKom(prevD,S.dist,S.v>0.2?dt:0);stepLap(S.dist,S.v>0.2?dt:0);
  const h=roadAt(S.dist).h;if(S.lastH!==null&&h>S.lastH)S.climb+=h-S.lastH;S.lastH=h;
  S.legPhase+=S.cadence/60*Math.PI*2*dt;
  const t=performance.now()/1000;
  // ~30-s-Mittel deiner Leistung (steigt schneller als es fällt): danach richten sich die Mitfahrer
  {const p=T.pedaling?S.power:0;S.p30+=(p-S.p30)*Math.min(1,dt/(p>S.p30?8:25));}
  stepBots(dt);
}
function trainerGradeCmd(){
  const r={grade:gradeAt(S.dist)},mass=S.mass+PHYS.bike;
  // Normale Kassette: echte Steigung, der Trainer rechnet Gang und Tempo selbst (Windschatten senkt den Luftwiderstand)
  if(!S.vshift)return {grade:clamp(gradeAt(S.dist)*S.diff,-0.10,0.20),crr:PHYS.crr,cw:0.51*draftFactor(S.dist,player)};
  const v=Math.max(S.v,0.5),k=curRatio()/trainerRatio(),SF=SHIFT_FEEL[S.shiftFeel]||SHIFT_FEEL.soft;
  // Straßenkraft beim aktuellen Tempo (Steigung, Rollwiderstand, Luftwiderstand mit Windschatten)
  // Trainer-Schwierigkeit wirkt (wie bei anderen Trainings-Apps) nur auf den Steigungsanteil, nicht auf Roll- und Luftwiderstand
  const th=Math.atan(r.grade),grav=mass*PHYS.g*Math.sin(th);
  let F=roadForce(v,r.grade,mass,draftFactor(S.dist,player))-grav+grav*S.diff;
  // Kopplung Beine ↔ Rad: dreht das virtuelle Hinterrad langsamer als das Rad rollt, läuft man im Freilauf
  // (kaum Widerstand, man tritt ins Leere → hochschalten). Dreht es schneller, muss man das Rad beschleunigen.
  const vw=wheelSpeed();
  if(!T.pedaling)F=FMIN;
  // Hinterrad dreht schneller als das Rad rollt (nach dem Hochschalten oder beim Anfahren): sanft nachziehen statt hart bremsen
  else if(vw!==null&&!(vw>v&&performance.now()-(S.brakeT||-1e9)<1200)){const full=COUPLE*mass*(vw-v);
    if(vw>v){const w=clamp(1-(performance.now()-(S.upT||-1e9))/1800,0,1),ws=T.startSoft||0;
      let add=w*Math.min(SF.up*mass*(vw-v),mass*SF.cap)+(1-w)*Math.min(full,mass*2.0);
      // Anfahren: Der Avatar steht noch, die Schwungmasse dreht schon – höchstens ca. 4–5 % extra, bis beide gleich schnell sind
      if(ws>0)add=ws*Math.min(0.3*mass*(vw-v),mass*0.45)+(1-ws)*add;
      F+=add;}
    else F+=full;}
  F=Math.max(F,FMIN);
  return {grade:clamp(F*k/(mass*PHYS.g)-0.004,-0.10,0.20),crr:0.004,cw:0};
}
const COUPLE=1/1.0,FMIN=4;
// Schaltgefühl: Übergangszeit der Übersetzung (s), Nachzieh-Steifigkeit (1/s) und Obergrenze (×Masse in N)
const SHIFT_FEEL={soft:{tau:0.45,up:0.30,cap:0.45},normal:{tau:0.25,up:0.55,cap:0.9},direct:{tau:0.05,up:1.0,cap:2.0}}; // Kopplungssteifigkeit (1/s) und minimale Bremskraft (N)
// Tritt-Erkennung: Nach dem Aufhören dreht die Schwungmasse des Trainers weiter. Wird sie gebremst, meldet der Trainer
// „Scheinleistung“, die den Avatar ewig weiterrollen ließe. Erkannt wird das an Kadenz 0 oder an einer abbremsenden Schwungmasse.
// Trainer meldet Raddrehzahl (Tempo) und Trittfrequenz → daraus ergibt sich der tatsächlich aufgelegte Gang.
// Gemessen wird nur einmal: bei gleichmäßigem Treten unter Last (kein Freilauf, nicht direkt nach dem Schalten),
// dann auf ganze Zähne gerundet und gespeichert. Danach bleibt der Wert fest, bis man ihn im Menü löscht.
const TG={samples:[],last:0,prevC:0,done:false,warned:false};
function trainerRatio(){return S.trMeas&&S.trMeas>1&&S.trMeas<5?S.trMeas:S.chain/S.cog;}
// nächster echter Gang (Kettenblatt × Ritzel) zu einer gemessenen Übersetzung, bevorzugt mit dem eingetragenen Kettenblatt
function snapGear(m){let best=null;const rings=[...new Set([S.chain,...bikeSetup().rings])];
  for(const r of rings)for(let c=10;c<=36;c++){const e=Math.abs(Math.log(r/c/m))+(r===S.chain?0:0.008);if(!best||e<best.e)best={ring:r,cog:c,ratio:r/c,e};}
  return best&&best.e<0.025?best:null;}
function measureTrainerGear(now){
  if(TG.done||S.sim||!S.vshift||!T.dev||T.speed===null||now-T.speedAt>1500||!T.pedaling||now-TG.last<500)return;TG.last=now;
  const c=S.cadence,steady=c>=60&&c<=115&&S.power>=80&&Math.abs(T.acc)<0.15&&Math.abs(c/(TG.prevC||c)-1)<0.06&&now-(S.shiftT||-1e9)>4000;TG.prevC=c;
  if(!steady)return;
  const r=T.speed/(c/60*2.096); // Wahoo rechnet intern mit 2096 mm Radumfang
  if(r<1||r>5)return;TG.samples.push(r);if(TG.samples.length>60)TG.samples.shift();
  if(TG.samples.length<40)return;const sorted=TG.samples.slice().sort((a,b)=>a-b),m=sorted[sorted.length>>1],spread=sorted[Math.floor(sorted.length*0.9)]/sorted[Math.floor(sorted.length*0.1)];
  if(spread>1.04)return; // Werte noch zu unruhig
  const g=snapGear(m);TG.samples=[];if(!g)return; // passt zu keinem echten Gang → lieber nichts übernehmen
  TG.done=true;const name=g.ring+'×'+g.cog;
  if(!S.trMeas){const old=trainerRatio();S.trMeas=g.ratio;S.trGear=name;saveSettings();
    if(Math.abs(g.ratio/old-1)>0.01)toast(`Trainer-Gang gemessen: ${g.ring} × ${g.cog} statt ${S.chain} × ${S.cog} – wird ab jetzt fest verwendet`);}
  else if(Math.abs(g.ratio/S.trMeas-1)>0.01&&!TG.warned){TG.warned=true;
    status(`Hinweis: Am Trainer liegt offenbar ${g.ring} × ${g.cog} auf, gespeichert ist ${S.trGear}. Falls du umgebaut hast: Menü → Rad, Gänge → „Neu messen“.`);}
  showTrainerGear();}
function showTrainerGear(){const el=$('vTrainGear');if(!el)return;
  if(!S.trMeas){el.textContent='Wird einmal beim Fahren mit Trainer gemessen (gleichmäßig treten, ab 80 W) und dann fest gespeichert.';return;}
  el.innerHTML=`Gemessen: <b>${S.trGear.replace('×',' × ')}</b> (Übersetzung ${S.trMeas.toFixed(2)}) – fest gespeichert. <button id="bTgReset" style="padding:0 8px;font-size:12px">Neu messen</button>`;
  $('bTgReset').onclick=()=>{S.trMeas=0;S.trGear='';TG.samples=[];TG.done=false;TG.warned=false;saveSettings();showTrainerGear();};}
function updatePedaling(dt){measureTrainerGear(performance.now());
  if(!T.dev||S.sim){T.pedaling=true;return;}
  const now=performance.now();let coasting;
  if(T.hasCad&&now-T.cadAt<2500){coasting=S.cadence<18;
    // Anfahren: Der Trainer meldet die Kadenz erst nach ein paar Kurbelumdrehungen. Leistung bei beschleunigender
    // Schwungmasse heißt auch ohne Kadenz „tritt“ (beim Ausrollen bremst die Schwungmasse immer ab).
    if(coasting&&S.power>40&&(T.pedaling?now-T.startT<4000:T.acc>0.08))coasting=false;}
  else{ // ohne Kadenz: Schwungmasse bremst gleichmäßig ab oder die Leistung bricht gegenüber den letzten Sekunden ein
    T.pAvg=(T.pAvg===undefined?S.power:T.pAvg*(1-dt/3)+S.power*(dt/3));
    coasting=S.power<12||(T.pedaling?(T.pAvg>40&&S.power<T.pAvg*0.45&&T.acc<-0.03):T.acc<-0.02);
    if(!T.pedaling&&!coasting)T.pAvg=S.power;}
  T.coastT=coasting?T.coastT+dt:0;
  if(T.pedaling&&T.coastT>(T.hasCad?0.4:0.9))T.pedaling=false;
  else if(!T.pedaling&&!coasting&&S.power>25&&((T.hasCad&&now-T.cadAt<2500)||T.acc>-0.02)){T.pedaling=true;T.startT=now;
    if(S.v<4)T.startSoft=1;}} // aus dem Stand: weich anfahren (s. trainerGradeCmd)
// Geschwindigkeit des virtuellen Hinterrads (m/s) im gewählten Gang, gemessen am Trainer
function curRatio(){return S.gr||GEARS[S.gear];}
function wheelSpeed(){const now=performance.now();
  if(T.speed!==null&&now-T.speedAt<2500)return T.speed*curRatio()/trainerRatio();
  if(T.dev&&S.cadence>0&&now-T.lastData<2500)return S.cadence/60*curRatio()*PHYS.circ;
  return null;}

/* ================= ERG-Modus & Workouts ================= */
// Segmente: [Dauer s, Start % FTP, End % FTP (Rampe), Beschriftung, frei?]  · absolute Watt: {w0,w1}
const WORKOUTS=[
 {id:'rec',name:'Regeneration',cat:'Locker',desc:'30 min ganz locker in Zone 1–2. Für den Tag nach harten Einheiten.',
  segs:[[300,.40,.55,'Einrollen'],[1200,.55,.55,'Locker kurbeln'],[300,.55,.40,'Ausrollen']]},
 {id:'base',name:'Grundlage 60',cat:'Ausdauer',desc:'60 min Grundlagenausdauer (Zone 2, 65–72 % FTP) mit kurzen Trittfrequenz-Wechseln.',
  segs:[[600,.45,.65,'Einrollen'],[900,.68,.68,'Zone 2'],[120,.72,.72,'Etwas zügiger'],[900,.68,.68,'Zone 2'],[120,.72,.72,'Etwas zügiger'],[600,.66,.66,'Zone 2'],[360,.60,.45,'Ausrollen']]},
 {id:'ss',name:'Sweet Spot 3×10',cat:'Schwelle',desc:'3 × 10 min bei 88–93 % FTP mit je 5 min Pause. Der Klassiker für mehr FTP mit wenig Ermüdung.',
  segs:[[600,.45,.70,'Einrollen'],[600,.90,.90,'Sweet Spot 1/3'],[300,.55,.55,'Pause'],[600,.90,.90,'Sweet Spot 2/3'],[300,.55,.55,'Pause'],[600,.91,.91,'Sweet Spot 3/3'],[600,.55,.40,'Ausrollen']]},
 {id:'thr',name:'Schwelle 2×20',cat:'Schwelle',desc:'2 × 20 min an der Schwelle (95–100 % FTP), 5 min Pause dazwischen.',
  segs:[[600,.45,.72,'Einrollen'],[60,1.0,1.0,'Öffner'],[240,.55,.55,'Locker'],[1200,.96,.96,'Schwelle 1/2'],[300,.55,.55,'Pause'],[1200,.97,.97,'Schwelle 2/2'],[600,.55,.40,'Ausrollen']]},
 {id:'ou',name:'Over-Unders 3×9',cat:'Schwelle',desc:'3 Blöcke à 9 min: abwechselnd 2 min bei 95 % und 1 min bei 108 %. Trainiert Laktatabbau unter Last.',
  segs:(()=>{const a=[[600,.45,.72,'Einrollen']];for(let b=1;b<=3;b++){for(let k=0;k<3;k++){a.push([120,.95,.95,`Block ${b}: unter`]);a.push([60,1.08,1.08,`Block ${b}: über`]);}a.push([300,.55,.55,'Pause']);}a.push([480,.55,.40,'Ausrollen']);return a;})()},
 {id:'vo2',name:'VO2max 5×3',cat:'Intervalle',desc:'5 × 3 min bei 115–120 % FTP, 3 min Pause. Hebt die maximale Sauerstoffaufnahme.',
  segs:(()=>{const a=[[600,.45,.72,'Einrollen'],[60,1.0,1.0,'Öffner'],[180,.55,.55,'Locker']];for(let i=1;i<=5;i++){a.push([180,1.18,1.18,`VO2max ${i}/5`]);a.push([180,.50,.50,'Pause']);}a.push([600,.55,.40,'Ausrollen']);return a;})()},
 {id:'4020',name:'40/20-Intervalle',cat:'Intervalle',desc:'3 Sätze à 8 × (40 s bei 120 % / 20 s bei 50 %), 5 min Pause zwischen den Sätzen.',
  segs:(()=>{const a=[[600,.45,.72,'Einrollen']];for(let st=1;st<=3;st++){for(let i=1;i<=8;i++){a.push([40,1.20,1.20,`Satz ${st} · ${i}/8 hart`]);a.push([20,.50,.50,'Kurz locker']);}a.push([300,.50,.50,'Satzpause']);}a.push([300,.50,.40,'Ausrollen']);return a;})()},
 {id:'pyr',name:'Pyramide',cat:'Intervalle',desc:'1–2–3–4–3–2–1 min bei 110 % FTP, jeweils gleich lange Pause.',
  segs:(()=>{const a=[[600,.45,.72,'Einrollen']];for(const m of [1,2,3,4,3,2,1]){a.push([m*60,1.10,1.10,`${m} min hart`]);a.push([m*60,.50,.50,'Pause']);}a.push([480,.55,.40,'Ausrollen']);return a;})()},
 {id:'tabata',name:'Tabata',cat:'Intervalle',desc:'2 × 8 × (20 s sehr hart / 10 s Pause). Kurz und brutal.',
  segs:(()=>{const a=[[600,.45,.70,'Einrollen'],[180,.55,.55,'Locker']];for(let st=1;st<=2;st++){for(let i=1;i<=8;i++){a.push([20,1.70,1.70,`Satz ${st} · ${i}/8`]);a.push([10,.40,.40,'Pause']);}a.push([300,.50,.50,'Satzpause']);}a.push([300,.50,.40,'Ausrollen']);return a;})()},
 {id:'sprint',name:'Sprints 6×15 s',cat:'Kraft',desc:'6 freie Sprints à 15 s ohne ERG (volle Kraft), 4:45 min Erholung.',
  segs:(()=>{const a=[[600,.45,.70,'Einrollen']];for(let i=1;i<=6;i++){a.push([15,2.0,2.0,`Sprint ${i}/6 – alles!`,1]);a.push([285,.50,.50,'Erholen']);}a.push([300,.50,.40,'Ausrollen']);return a;})()},
 {id:'ftp20',name:'FTP-Test 20 min',cat:'Test',desc:'Klassischer 20-min-Test: Einrollen mit Öffnern, 5 min hart, dann 20 min so viel wie möglich (frei, ohne ERG). FTP = 95 % des 20-min-Schnitts.',
  segs:[[600,.45,.70,'Einrollen'],[60,1.05,1.05,'Öffner'],[60,.55,.55,'Locker'],[60,1.05,1.05,'Öffner'],[180,.55,.55,'Locker'],[300,1.05,1.05,'5 min hart',1],[600,.50,.50,'Erholen'],[1200,1.0,1.0,'20 min – gleichmäßig maximal',1,'test20'],[600,.50,.40,'Ausrollen']]},
 {id:'ramp',name:'Rampentest',cat:'Test',desc:'Start bei 100 W, jede Minute +20 W bis zur Erschöpfung. FTP ≈ 75 % der besten 1-min-Leistung.',
  segs:(()=>{const a=[[300,{w:90},{w:100},'Einrollen']];for(let i=0;i<30;i++)a.push([60,{w:100+20*i},{w:100+20*i},`Stufe ${i+1}: ${100+20*i} W`,0,'ramp']);a.push([300,{w:100},{w:70},'Ausrollen']);return a;})()},
];
const W={active:false,wo:null,idx:0,t:0,total:0,bias:1,ergOn:true,done:false,acc:{},max1:0,win:[],lowT:0};
function segWatts(seg,frac){const a=seg[1],b=seg[2];
  const v0=typeof a==='object'?a.w:a*S.ftp,v1=typeof b==='object'?b.w:b*S.ftp;return v0+(v1-v0)*frac;}
function woDuration(wo){return wo.segs.reduce((s,x)=>s+x[0],0);}
function ergActive(){if(W.active&&!W.done){const sg=W.wo.segs[W.idx];return W.ergOn&&!sg[4];}return S.erg;}
function targetWatts(){
  if(W.active&&!W.done){const sg=W.wo.segs[W.idx];return Math.round(segWatts(sg,clamp(W.t/sg[0],0,1))*(typeof sg[1]==='object'?1:W.bias));}
  return S.erg?S.ergW:null;}
function startWorkout(id){const wo=WORKOUTS.find(w=>w.id===id);if(!wo)return;
  Object.assign(W,{active:true,wo,idx:0,t:0,total:0,bias:1,done:false,acc:{},max1:0,win:[],lowT:0});
  $('woBox').classList.remove('hidden');drawWorkout();sendResistance(true);}
function stopWorkout(){W.active=false;$('woBox').classList.add('hidden');sendResistance(true);}
function finishWorkout(reason){W.done=true;let msg=reason||'Workout geschafft! 🎉';
  if(W.acc.test20&&W.acc.test20.n>0){const avg=W.acc.test20.sum/W.acc.test20.n;msg=`20-min-Schnitt ${Math.round(avg)} W → neue FTP ≈ ${Math.round(avg*0.95)} W`;S.ftpSuggest=Math.round(avg*0.95);}
  if(W.wo.id==='ramp'&&W.max1>0){msg=`Beste 1-min-Leistung ${Math.round(W.max1)} W → FTP ≈ ${Math.round(W.max1*0.75)} W`;S.ftpSuggest=Math.round(W.max1*0.75);}
  $('woSeg').textContent='Fertig';$('woNext').innerHTML=msg+(S.ftpSuggest?` <button id="woApply">als FTP übernehmen</button>`:'');
  const b=$('woApply');if(b)b.onclick=()=>{S.ftp=S.ftpSuggest;$('iFtp').value=S.ftp;saveSettings();b.remove();};
  sendResistance(true);}
function stepWorkout(dt){
  if(!W.active||W.done)return;
  const sg=W.wo.segs[W.idx];W.t+=dt;W.total+=dt;
  if(sg[5]){const k=sg[5];W.acc[k]=W.acc[k]||{sum:0,n:0};W.acc[k].sum+=S.power*dt;W.acc[k].n+=dt;}
  W.win.push([W.total,S.power]);while(W.win.length&&W.total-W.win[0][0]>60)W.win.shift();
  if(W.total>60){const avg=W.win.reduce((a,b)=>a+b[1],0)/W.win.length;W.max1=Math.max(W.max1,avg);}
  // Rampentest: Ende, wenn die Leistung 10 s deutlich unter dem Ziel liegt
  if(sg[5]==='ramp'){const tw=targetWatts();if(S.power<tw*0.6&&!S.sim)W.lowT+=dt;else W.lowT=0;if(W.lowT>10){finishWorkout();return;}}
  if(W.t>=sg[0]){W.t-=sg[0];W.idx++;if(W.idx>=W.wo.segs.length){finishWorkout();return;}sendResistance(true);}}
function ergNudge(d){
  if(W.active&&!W.done){W.bias=clamp(W.bias+d*0.05,0.5,1.5);}
  else{S.ergW=clamp(S.ergW+d*10,50,1200);saveSettings();}
  updateErgUi();sendResistance(true);}
function updateErgUi(){
  const tw=targetWatts(),on=ergActive();
  $('ergBox').classList.toggle('on',on);$('ergState').textContent=on?'ERG':(W.active?'frei':'aus');
  $('ergW').textContent=tw!==null?tw:'–';
  $('ergSub').textContent=W.active&&!W.done?`Intensität ${Math.round(W.bias*100)} %`:(S.erg?'+/− ändert die Zielleistung':'Freies Fahren');}
function drawWorkoutOn(c,wo,done,idx){
  const dpr=Math.min(devicePixelRatio,2),w=c.clientWidth,h=c.clientHeight;if(!w)return;
  if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr;c.height=h*dpr;}
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  const tot=woDuration(wo);let maxW=S.ftp*1.25;for(const sg of wo.segs)maxW=Math.max(maxW,segWatts(sg,0),segWatts(sg,1));
  let t0=0;const Y=v=>h-(v/maxW)*(h-4);
  wo.segs.forEach((sg,i)=>{const x0=t0/tot*w,x1=(t0+sg[0])/tot*w,w0=segWatts(sg,0),w1=segWatts(sg,1),pct=(w0+w1)/2/S.ftp;
    x.fillStyle=sg[4]?'#8a8fff':pct<0.6?'#7f8c9a':pct<0.76?'#2e86de':pct<0.9?'#20bf6b':pct<1.05?'#f7b731':pct<1.2?'#fa8231':'#eb3b5a';
    x.globalAlpha=i<idx?0.45:1;x.beginPath();x.moveTo(x0,h);x.lineTo(x0,Y(w0));x.lineTo(x1+0.5,Y(w1));x.lineTo(x1+0.5,h);x.closePath();x.fill();t0+=sg[0];});
  x.globalAlpha=1;
  if(done!==null){const px=done/tot*w;x.strokeStyle='#1e0f3a';x.lineWidth=2;x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();}
  x.strokeStyle='rgba(30,15,58,.55)';x.setLineDash([4,4]);x.beginPath();x.moveTo(0,Y(S.ftp));x.lineTo(w,Y(S.ftp));x.stroke();x.setLineDash([]);
  x.fillStyle='#1e0f3a';x.font='600 10px Fredoka,system-ui';x.fillText('FTP',3,Y(S.ftp)-3);}
function drawWorkout(){if(!W.active)return;
  const done=W.wo.segs.slice(0,W.idx).reduce((s,a)=>s+a[0],0)+W.t;drawWorkoutOn($('woChart'),W.wo,W.done?woDuration(W.wo):done,W.idx);}
function updateWorkoutHud(){
  if(!W.active)return;
  if(!W.done){const sg=W.wo.segs[W.idx],left=sg[0]-W.t,nx=W.wo.segs[W.idx+1];
    $('woName').textContent=W.wo.name;$('woSeg').textContent=sg[3];
    $('woLeft').textContent=fmtTime(Math.ceil(left));
    const tot=woDuration(W.wo),done=W.wo.segs.slice(0,W.idx).reduce((s,a)=>s+a[0],0)+W.t;
    $('woTotal').textContent='noch '+fmtTime(Math.ceil(tot-done));
    $('woNext').textContent=nx?`Danach: ${nx[3]} · ${fmtTime(nx[0])} · ${Math.round(segWatts(nx,0)*(typeof nx[1]==='object'?1:W.bias))} W`:'Gleich geschafft!';
    const tw=targetWatts(),dv=S.power-tw,pe=$('woPow');pe.textContent=Math.round(S.power)+' / '+tw+' W';
    pe.style.color=Math.abs(dv)<tw*0.06?'#36d07a':dv<0?'#ffcc33':'#ff7a1a';}
  drawWorkout();}

/* ================= Bergwertung (Zeitmessung am Berg) ================= */
const KOM={act:null,shownT:0,store:null};
function komStore(){if(!KOM.store){try{KOM.store=JSON.parse(localStorage.getItem('kalea_kom')||'{}');}catch(e){KOM.store={};}}return KOM.store;}
function komSave(){try{localStorage.setItem('kalea_kom',JSON.stringify(KOM.store));}catch(e){}}
function komPB(c){const e=komStore()[c.key];return e&&e.pb?e.pb:null;}
function stepKom(prev,cur,dt){
  const a=KOM.act;
  if(a){a.t+=dt;a.e+=S.power*(T.pedaling?1:0)*dt;if(S.hr){a.hr+=S.hr*dt;a.hrT+=dt;}
    const done=cur-a.d0;while(a.splits.length*50<=Math.min(done,a.c.len))a.splits.push(Math.round(a.t*10)/10);
    if(done>=a.c.len){const over=done-a.c.len,tEnd=a.t-dt*Math.min(1,over/Math.max(0.01,cur-prev));finishKom(a,tEnd);KOM.act=null;}
    else if(done<-5||a.t>3*3600)KOM.act=null;
    return;}
  for(const c of CLIMBS){const k=Math.floor((cur-c.start)/L),ds0=c.start+k*L;
    if(prev<ds0&&cur>=ds0){const frac=(cur-ds0)/Math.max(0.01,cur-prev);KOM.act={c,d0:ds0,t:dt*frac,e:0,hr:0,hrT:0,splits:[0]};break;}}}
function finishKom(a,t){
  const c=a.c,st=komStore(),e=st[c.key]||(st[c.key]={name:c.name,world:WORLD,len:c.len,gain:c.gain,hist:[]});
  const res={t:Math.round(t*10)/10,p:Math.round(a.e/Math.max(1,a.t)),hr:a.hrT>10?Math.round(a.hr/a.hrT):0,kg:S.mass,date:Date.now(),sim:S.sim,route:ROUTE.name};
  if(a.rb)res.rb=true;const pb=e.pb,isPb=!a.rb&&(!pb||res.t<pb.t);e.name=c.name;e.len=c.len;e.gain=c.gain;e.hist.unshift(res);e.hist=e.hist.slice(0,20);
  if(isPb)e.pb={...res,splits:a.splits};komSave();REC.koms.push({name:c.name,t:res.t,p:res.p,len:c.len,pb:isPb});showKomBanner(c,res,pb,isPb);}
function fmtDelta(x){const s=Math.round(Math.abs(x));return (x<0?'−':'+')+Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function showKomBanner(c,res,pb,isPb){
  const v=c.len/res.t*3.6,vam=c.gain/res.t*3600,b=$('komBanner');b.classList.remove('lap');
  b.innerHTML=`<div class="kb-t">BERGWERTUNG · ${c.name.toUpperCase()}</div><div class="kb-time">${fmtTime(res.t)}<small>${(res.t%1).toFixed(1).slice(1)}</small></div>
    <div class="kb-pb ${isPb?'new':''}">${res.rb?'🪢 mit Gummiband – zählt nicht als Bestzeit':isPb?(pb?'NEUE BESTZEIT! '+fmtDelta(res.t-pb.t):'ERSTE ZEIT – deine Bestzeit!'):'Bestzeit '+fmtTime(pb.t)+' · '+fmtDelta(res.t-pb.t)}</div>
    <div class="kb-row"><span><b>${res.p}</b> W</span><span><b>${(res.p/S.mass).toFixed(1)}</b> W/kg</span><span><b>${v.toFixed(1)}</b> km/h</span><span><b>${Math.round(vam)}</b> VAM</span>${res.hr?`<span><b>${res.hr}</b> bpm</span>`:''}</div>
    <div class="kb-s">${(c.len/1000).toFixed(2)} km · ${Math.round(c.gain)} hm · Ø ${(+c.avg).toFixed(1)} %</div>`;
  b.classList.remove('hidden');b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');KOM.shownT=performance.now();
  if(isPb)confetti();}
function updateKomHud(now){
  const box=$('komBox'),a=KOM.act;
  if(KOM.shownT&&now-KOM.shownT>11000){$('komBanner').classList.add('hidden');KOM.shownT=0;}
  if(a){const done=S.dist-a.d0,pb=komPB(a.c);let dl='';
    if(pb&&pb.splits&&pb.splits.length>1){const j=done/50,j0=Math.min(Math.floor(j),pb.splits.length-1),j1=Math.min(j0+1,pb.splits.length-1),pt=pb.splits[j0]+(pb.splits[j1]-pb.splits[j0])*(j-Math.floor(j));
      const dd=a.t-pt;dl=`<span class="kd ${dd<=0?'g':'r'}">${fmtDelta(dd)}</span>`;}
    box.innerHTML=`<div class="kn">⛰ ${a.c.name}</div><div class="kt">${fmtTime(a.t)}${dl}</div><div class="kbar"><i style="width:${clamp(done/a.c.len*100,0,100)}%"></i></div><div class="ks">noch ${((a.c.len-done)/1000).toFixed(2)} km${pb?' · Bestzeit '+fmtTime(pb.t):''}</div>`;
    box.classList.remove('hidden');return;}
  const d=((S.dist%L)+L)%L,nx=CLIMBS.map(c=>({c,dd:((c.start-d)%L+L)%L})).sort((x,y)=>x.dd-y.dd)[0];
  if(nx&&nx.dd<800){const pb=komPB(nx.c);box.innerHTML=`<div class="kn">⛰ ${nx.c.name}</div><div class="ks">Bergwertung in <b>${Math.round(nx.dd)} m</b> · ${(nx.c.len/1000).toFixed(1)} km, Ø ${(+nx.c.avg).toFixed(1)} %${pb?'<br>Bestzeit '+fmtTime(pb.t):''}</div>`;box.classList.remove('hidden');}
  else box.classList.add('hidden');}
function komTable(){
  const st=komStore(),rows=[];const known=new Set();
  for(const c of CLIMBS){known.add(c.key);rows.push([c.key,c.name,c,st[c.key]]);}
  for(const k in st)if(!known.has(k)&&st[k].world===WORLD)rows.push([k,st[k].name,null,st[k]]);
  if(!rows.length)return '<p class="hint">Diese Route hat keine Bergwertung.</p>';
  return '<table class="kt"><tr><th>Anstieg</th><th>Bestzeit</th><th>Ø W</th><th>Letzte</th></tr>'+rows.map(([k,n,c,e])=>{const pb=e&&e.pb,l=e&&e.hist[0];
    return `<tr><td>${n}${c?` <small>${(c.len/1000).toFixed(1)} km · ${Math.round(c.gain)} hm</small>`:' <small>(andere Route)</small>'}</td><td><b>${pb?fmtTime(pb.t):'–'}</b>${pb?`<small>${new Date(pb.date).toLocaleDateString('de-DE')}</small>`:''}</td><td>${pb?pb.p:'–'}</td><td>${l?fmtTime(l.t):'–'}</td></tr>`;}).join('')+'</table>';}
function confetti(){const c=$('fx'),x=c.getContext('2d'),W=c.width=innerWidth,H=c.height=innerHeight,P=[];const cols=['#490cb8','#9d20a3','#eb567b','#f8d74e','#ffffff','#f48fa8'];
  for(let i=0;i<160;i++)P.push({x:W/2+(Math.random()-0.5)*200,y:H*0.25,vx:(Math.random()-0.5)*14,vy:-Math.random()*12-4,r:Math.random()*6.28,c:cols[i%cols.length],s:5+Math.random()*7});
  let t0=performance.now();c.classList.remove('hidden');
  (function anim(now){const t=(now-t0)/1000;x.clearRect(0,0,W,H);for(const p of P){p.vy+=0.35;p.vx*=0.99;p.x+=p.vx;p.y+=p.vy;p.r+=0.2;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.strokeStyle='#1e0f3a';x.lineWidth=1.5;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.strokeRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore();}
    if(t<3.5)requestAnimationFrame(anim);else{x.clearRect(0,0,W,H);c.classList.add('hidden');}})(t0);}

/* ================= Runde geschafft (Strecke einmal komplett gefahren) ================= */
const LAP={act:null,store:null};
function lapStore(){if(!LAP.store){try{LAP.store=JSON.parse(localStorage.getItem('kalea_laps')||'{}');}catch(e){LAP.store={};}}return LAP.store;}
function stepLap(cur,dt){let a=LAP.act;
  if(!a||cur<a.d0-5){LAP.act={d0:Math.floor(Math.max(0,cur)/L)*L,t:0,e:0,hr:0,hrT:0,cad:0,cadT:0,c0:S.climb,vmax:0};return;}
  a.t+=dt;a.e+=(T.pedaling?S.power:0)*dt;if(S.hr){a.hr+=S.hr*dt;a.hrT+=dt;}if(S.cadence>0){a.cad+=S.cadence*dt;a.cadT+=dt;}a.vmax=Math.max(a.vmax,S.v);
  if(cur>=a.d0+L){finishLap(a);LAP.act={d0:a.d0+L,t:0,e:0,hr:0,hrT:0,cad:0,cadT:0,c0:S.climb,vmax:0};}}
function finishLap(a){if(a.t<30)return;
  const key=WORLD+'_'+ROUTE.id,st=lapStore(),e=st[key]||(st[key]={name:ROUTE.name,world:WORLD,len:L,hist:[]});
  const res={t:Math.round(a.t*10)/10,p:Math.round(a.e/Math.max(1,a.t)),hr:a.hrT>10?Math.round(a.hr/a.hrT):0,cad:a.cadT>10?Math.round(a.cad/a.cadT):0,
    gain:Math.round(S.climb-a.c0),vmax:a.vmax,kj:Math.round(a.e/1000),kg:S.mass,date:Date.now(),sim:S.sim};
  if(a.rb)res.rb=true;const pb=e.pb,isPb=!a.rb&&(!pb||res.t<pb.t);e.hist.unshift(res);e.hist=e.hist.slice(0,20);if(isPb)e.pb=res;try{localStorage.setItem('kalea_laps',JSON.stringify(st));}catch(x){}
  const nr=Math.round(a.d0/L)+1;REC.laps.push({n:nr,...res,pb:isPb});
  if(NET.state==='on'&&NET.info&&NET.info.mode==='race')return; // im Rennen zeigt das Ergebnis-Fenster alles
  const show=()=>showLapBanner(res,pb,isPb,nr),wait=KOM.shownT?6000-(performance.now()-KOM.shownT):0;
  if(wait>0)setTimeout(show,wait);else show();}
function showLapBanner(res,pb,isPb,nr){
  const v=L/res.t*3.6,b=$('komBanner');b.classList.add('lap');
  b.innerHTML=`<div class="kb-t">🏁 RUNDE ${nr>1?nr+' ':''}GESCHAFFT · ${ROUTE.name.toUpperCase()}</div><div class="kb-time">${fmtTime(res.t)}<small>${(res.t%1).toFixed(1).slice(1)}</small></div>
    <div class="kb-pb ${isPb?'new':''}">${res.rb?'🪢 mit Gummiband – zählt nicht als Bestzeit':isPb?(pb?'NEUE BESTZEIT! '+fmtDelta(res.t-pb.t):'ERSTE RUNDE – deine Bestzeit!'):'Bestzeit '+fmtTime(pb.t)+' · '+fmtDelta(res.t-pb.t)}</div>
    <div class="kb-row"><span><b>${res.p}</b> W</span><span><b>${(res.p/S.mass).toFixed(1)}</b> W/kg</span><span><b>${v.toFixed(1)}</b> km/h</span>${res.hr?`<span><b>${res.hr}</b> bpm</span>`:''}${res.cad?`<span><b>${res.cad}</b> rpm</span>`:''}</div>
    <div class="kb-s">${(L/1000).toFixed(2)} km · ${res.gain} hm · max. ${(res.vmax*3.6).toFixed(1)} km/h · ${res.kj} kJ</div>`;
  b.classList.remove('hidden');b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');KOM.shownT=performance.now();confetti();}

/* ================= Fahrt-Statistik ================= */
const REC={s:[],acc:0,start:Date.now(),koms:[],laps:[],ended:false};
const ZONES=[{n:'Z1 Regeneration',lo:0,hi:0.55,c:'#9aa3ad'},{n:'Z2 Grundlage',lo:0.55,hi:0.75,c:'#3e8fe0'},{n:'Z3 Tempo',lo:0.75,hi:0.90,c:'#2fbf62'},
  {n:'Z4 Schwelle',lo:0.90,hi:1.05,c:'#f2c230'},{n:'Z5 VO2max',lo:1.05,hi:1.20,c:'#ff7a1a'},{n:'Z6 Anaerob',lo:1.20,hi:1.50,c:'#e8463c'},{n:'Z7 Sprint',lo:1.50,hi:99,c:'#9b5de5'}];
function zoneOf(p){const f=p/S.ftp;return ZONES.findIndex(z=>f>=z.lo&&f<z.hi);}
function recStep(dt){if(REC.ended)return;REC.acc+=dt;if(REC.acc<1)return;REC.acc-=1;
  const r=roadAt(S.dist);REC.s.push({t:Math.round(S.elapsed),d:Math.round(S.dist),v:+S.v.toFixed(2),p:Math.round(T.pedaling?S.power:0),c:Math.round(S.cadence),hr:S.hr||0,h:+(r.h+(IS_ULM?UY0:0)).toFixed(1),x:+r.x.toFixed(1),z:+r.z.toFixed(1)});}
function bestAvg(arr,win){if(arr.length<win)return null;let s=0,b=0;for(let i=0;i<arr.length;i++){s+=arr[i];if(i>=win)s-=arr[i-win];if(i>=win-1)b=Math.max(b,s/win);}return b;}
function rideSummary(){
  const A=REC.s,n=A.length,P=A.map(x=>x.p);if(!n)return null;
  const mov=A.filter(x=>x.v>0.5).length,dist=Math.max(0,A[n-1].d-A[0].d+(A[0].d>0?0:0));
  let gain=0;for(let i=1;i<n;i++){const dh=A[i].h-A[i-1].h;if(dh>0)gain+=dh;}
  const avgP=P.reduce((a,b)=>a+b,0)/n,maxP=Math.max(...P);
  let np=0;{const r=[];let s=0;for(let i=0;i<n;i++){s+=P[i];if(i>=30)s-=P[i-30];if(i>=29)r.push(Math.pow(s/30,4));}np=r.length?Math.pow(r.reduce((a,b)=>a+b,0)/r.length,0.25):avgP;}
  const IF=np/S.ftp,tss=n*np*IF/(S.ftp*3600)*100,kj=P.reduce((a,b)=>a+b,0)/1000;
  const hrs=A.filter(x=>x.hr>0).map(x=>x.hr),cads=A.filter(x=>x.c>0).map(x=>x.c);
  const zt=ZONES.map(()=>0);for(const p of P){const z=zoneOf(p);if(z>=0&&p>0)zt[z]++;}
  const curve=[[5,'5 s'],[30,'30 s'],[60,'1 min'],[300,'5 min'],[600,'10 min'],[1200,'20 min'],[3600,'60 min']].map(([w,l])=>({w,l,p:bestAvg(P,w)}));
  return {n,mov,dist,time:A[n-1].t,avgV:mov?dist/mov:0,maxV:Math.max(...A.map(x=>x.v)),gain,avgP,maxP,np,IF,tss,kj,kcal:kj*1.0,
    avgHr:hrs.length?hrs.reduce((a,b)=>a+b,0)/hrs.length:0,maxHr:hrs.length?Math.max(...hrs):0,avgCad:cads.length?cads.reduce((a,b)=>a+b,0)/cads.length:0,zt,curve};}
function saveRideHistory(sum){try{const h=JSON.parse(localStorage.getItem('kalea_rides')||'[]');
  h.unshift({date:Date.now(),world:WORLD,route:ROUTE.name,dist:sum.dist,time:sum.time,gain:sum.gain,avgP:Math.round(sum.avgP),np:Math.round(sum.np),tss:Math.round(sum.tss),avgV:sum.avgV});
  localStorage.setItem('kalea_rides',JSON.stringify(h.slice(0,30)));}catch(e){}}
function rideHistory(){try{return JSON.parse(localStorage.getItem('kalea_rides')||'[]');}catch(e){return [];}}
function endRide(){if(!REC.s.length){status('Noch keine Daten – erst ein Stück fahren.');return;}
  REC.ended=true;S.riding=false;S.paused=true;S.v=0;const sum=rideSummary();saveRideHistory(sum);sendResistance(true);
  if(typeof netEndRide==='function')netEndRide();
  $('bStart').textContent='Neue Fahrt';$('bStart').onclick=newRide;$('bEnd').classList.add('hidden');showStats(true);}
function kpi(v,u,l,c){return `<div class="kpi" style="--kc:${c}"><b>${v}<small>${u}</small></b><span>${l}</span></div>`;}
function showStats(final){
  const sum=rideSummary(),el=$('statsView');$('setup').classList.add('hidden');
  if(!sum){el.innerHTML=`<div class="sv-card"><div class="sv-head"><h2>Statistik</h2><button id="svClose">Schließen</button></div><p class="hint" style="padding:20px">Noch keine Daten – fahr ein Stück, dann erscheinen hier deine Werte und Diagramme.</p></div>`;el.classList.remove('hidden');$('svClose').onclick=closeStats;return;}
  const hh=sum.avgHr>0,wkg=sum.avgP/S.mass;
  const komRows=REC.koms.map(k=>`<tr><td>⛰ ${k.name}</td><td><b>${fmtTime(k.t)}</b>${k.pb?' <span class="pbtag">Bestzeit!</span>':''}</td><td>${k.p} W</td><td>${(k.len/k.t*3.6).toFixed(1)} km/h</td></tr>`).join('');
  const lapRows=REC.laps.map(k=>`<tr><td>🏁 Runde ${k.n}</td><td><b>${fmtTime(k.t)}</b>${k.pb?' <span class="pbtag">Bestzeit!</span>':''}</td><td>${k.p} W</td><td>${(L/k.t*3.6).toFixed(1)} km/h</td></tr>`).join('');
  const hist=rideHistory().slice(final?1:0,8);
  el.innerHTML=`<div class="sv-card">
    <div class="sv-head"><div><h2>${final?'Fahrt beendet 🎉':'Deine Fahrt bisher'}</h2><p>${ROUTE.name} · ${new Date(REC.start).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})}</p></div>
      <div class="sv-btns">${final?'<button id="svNew" class="primary">Neue Fahrt</button>':'<button id="svBack" class="primary">Weiterfahren</button><button id="svEnd">Fahrt beenden</button>'}<button id="svTcx" title="Datei für Strava, Garmin Connect oder TrainingPeaks">TCX speichern</button><button id="svClose">✕</button></div></div>
    <div class="sv-body">
      <div class="kpis">${kpi((sum.dist/1000).toFixed(2),'km','Distanz','#490cb8')}${kpi(fmtTime(sum.time),'','Fahrzeit','#f8d74e')}${kpi((sum.avgV*3.6).toFixed(1),'km/h','Ø Tempo','#7ad35a')}
        ${kpi(Math.round(sum.gain),'hm','Höhenmeter','#e8463c')}${kpi(Math.round(sum.avgP),'W','Ø Leistung','#eb567b')}${kpi(Math.round(sum.np),'W','Normalized Power','#f48fa8')}
        ${kpi(wkg.toFixed(2),'W/kg','Ø Watt pro kg','#b06fe0')}${kpi(Math.round(sum.tss),'','TSS · IF '+sum.IF.toFixed(2),'#3e8fe0')}${kpi(Math.round(sum.kcal),'kcal','Energie ('+Math.round(sum.kj)+' kJ)','#ff8fb8')}
        ${kpi(Math.round(sum.maxP),'W','Max. Leistung','#e8463c')}${kpi((sum.maxV*3.6).toFixed(1),'km/h','Max. Tempo','#7ad35a')}${kpi(sum.avgCad?Math.round(sum.avgCad):'–','rpm','Ø Trittfrequenz','#9aa3ad')}
        ${hh?kpi(Math.round(sum.avgHr),'bpm','Ø Puls (max '+sum.maxHr+')','#e8463c'):''}</div>
      <h3>Verlauf <small>über die Strecke – mit dem Finger oder der Maus darüberfahren</small></h3>
      <div class="sv-chartwrap"><canvas id="svSeries"></canvas><div id="svTip" class="sv-tip hidden"></div></div>
      <div class="sv-two">
        <div><h3>Zeit in Leistungszonen <small>FTP ${S.ftp} W</small></h3><canvas id="svZones"></canvas></div>
        <div><h3>Beste Leistung <small>Watt über die Dauer</small></h3><canvas id="svCurve"></canvas></div>
      </div>
      <div class="sv-two">
        <div><h3>Deine Spur</h3><canvas id="svMap"></canvas></div>
        <div>${lapRows?`<h3>Runden dieser Fahrt</h3><table class="kt">${lapRows}</table>`:''}${komRows?`<h3>Bergwertungen dieser Fahrt</h3><table class="kt">${komRows}</table>`:'<h3>Bergwertungen</h3><p class="hint">Auf dieser Fahrt noch keine Bergwertung gefahren.</p>'}
          ${hist.length?`<h3>Frühere Fahrten</h3><table class="kt"><tr><th>Datum</th><th>Route</th><th>km</th><th>Zeit</th><th>Ø W</th></tr>${hist.map(h=>`<tr><td>${new Date(h.date).toLocaleDateString('de-DE')}</td><td>${h.route}</td><td>${(h.dist/1000).toFixed(1)}</td><td>${fmtTime(h.time)}</td><td>${h.avgP}</td></tr>`).join('')}</table>`:''}</div>
      </div></div></div>`;
  el.classList.remove('hidden');if(!final)S.paused=true;
  $('svClose').onclick=closeStats;if($('svBack'))$('svBack').onclick=()=>{closeStats();};if($('svEnd'))$('svEnd').onclick=endRide;
  if($('svNew'))$('svNew').onclick=newRide;
  $('svTcx').onclick=exportTcx;
  requestAnimationFrame(()=>{drawSeries(sum);drawZones(sum);drawCurve(sum);drawTrack();});}
function closeStats(){$('statsView').classList.add('hidden');if(REC.ended){openMenu();return;}S.paused=false;}
function prepCanvas(c,hgt){const dpr=Math.min(devicePixelRatio,2),w=c.clientWidth,h=hgt||c.clientHeight;c.width=w*dpr;c.height=h*dpr;const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [x,w,h];}
// gestapelte Verlaufs-Diagramme mit gemeinsamer x-Achse (Distanz), jedes mit eigener y-Achse
function drawSeries(sum){
  const c=$('svSeries'),A=REC.s,hasHr=sum.avgHr>0,panels=[
    {k:'p',n:'Leistung',u:'W',col:'#eb567b',zone:true},{k:'v',n:'Tempo',u:'km/h',col:'#490cb8',f:v=>v*3.6},
    ...(hasHr?[{k:'hr',n:'Puls',u:'bpm',col:'#e8463c'}]:[]),{k:'c',n:'Trittfrequenz',u:'rpm',col:'#b06fe0'},{k:'h',n:'Höhe',u:'m',col:'#7ad35a',area:true}];
  const ph=78,gap=10,H=panels.length*(ph+gap)+18;c.style.height=H+'px';const [x,w]=prepCanvas(c,H),L0=44,R0=8,pw=w-L0-R0;
  const d0=A[0].d,d1=Math.max(d0+1,A[A.length-1].d),X=d=>L0+(d-d0)/(d1-d0)*pw;
  x.font='600 11px Fredoka,system-ui';
  panels.forEach((pn,k)=>{const top=k*(ph+gap)+2,vals=A.map(s=>pn.f?pn.f(s[pn.k]):s[pn.k]);let mn=Math.min(...vals),mx=Math.max(...vals);
    if(pn.k!=='h')mn=0;if(mx-mn<1)mx=mn+1;const pad=(mx-mn)*0.08,lo=pn.k==='h'?mn-pad:0,hi=mx+pad,Y=v=>top+ph-(v-lo)/(hi-lo)*ph;pn.Y=Y;pn.vals=vals;pn.top=top;
    x.fillStyle='rgba(30,15,58,.04)';x.fillRect(L0,top,pw,ph);
    x.strokeStyle='rgba(30,15,58,.12)';x.lineWidth=1;for(let q=0;q<=2;q++){const yy=top+ph*q/2;x.beginPath();x.moveTo(L0,yy);x.lineTo(L0+pw,yy);x.stroke();}
    x.fillStyle='#6b6577';x.textAlign='right';x.textBaseline='middle';x.fillText(Math.round(hi),L0-5,top+3);x.fillText(Math.round(lo),L0-5,top+ph-3);
    x.textAlign='left';x.textBaseline='top';x.fillStyle='#1e0f3a';x.fillText(pn.n+' ('+pn.u+')',L0+6,top+4);
    if(pn.zone){// Leistung: Balken in Zonenfarben + geglättete Linie
      const bw=Math.max(1,pw/A.length+0.5);A.forEach((s,i)=>{const z=zoneOf(s.p);if(s.p<=0||z<0)return;x.fillStyle=ZONES[z].c;x.globalAlpha=0.55;x.fillRect(X(s.d),Y(vals[i]),bw,top+ph-Y(vals[i]));});x.globalAlpha=1;
      const sm=vals.map((_,i)=>{let a=0,n=0;for(let j=Math.max(0,i-14);j<=Math.min(vals.length-1,i+15);j++){a+=vals[j];n++;}return a/n;});
      x.beginPath();sm.forEach((v,i)=>i?x.lineTo(X(A[i].d),Y(v)):x.moveTo(X(A[i].d),Y(v)));x.strokeStyle='#1e0f3a';x.lineWidth=2;x.stroke();
      const ay=Y(sum.avgP);x.setLineDash([5,4]);x.strokeStyle='rgba(30,15,58,.6)';x.lineWidth=1.2;x.beginPath();x.moveTo(L0,ay);x.lineTo(L0+pw,ay);x.stroke();x.setLineDash([]);
      x.textAlign='right';x.fillStyle='#1e0f3a';x.fillText('Ø '+Math.round(sum.avgP)+' W',L0+pw-4,ay-14);}
    else{x.beginPath();vals.forEach((v,i)=>i?x.lineTo(X(A[i].d),Y(v)):x.moveTo(X(A[i].d),Y(v)));
      if(pn.area){x.lineTo(X(A[A.length-1].d),top+ph);x.lineTo(X(A[0].d),top+ph);x.closePath();x.fillStyle=pn.col+'88';x.fill();x.beginPath();vals.forEach((v,i)=>i?x.lineTo(X(A[i].d),Y(v)):x.moveTo(X(A[i].d),Y(v)));}
      x.strokeStyle=pn.col;x.lineWidth=2;x.stroke();}});
  // x-Achse
  x.fillStyle='#6b6577';x.textAlign='center';x.textBaseline='top';const span=(d1-d0)/1000,stp=span>40?10:span>15?5:span>6?2:span>2.5?1:0.5;
  for(let km=Math.ceil(d0/1000/stp)*stp;km<=d1/1000;km+=stp)x.fillText((+km.toFixed(1))+' km',X(km*1000),H-14);
  // Hover/Touch: Fadenkreuz mit allen Werten
  const tip=$('svTip'),move=e=>{const r=c.getBoundingClientRect(),px=(e.touches?e.touches[0].clientX:e.clientX)-r.left;if(px<L0||px>L0+pw){tip.classList.add('hidden');return;}
    const d=d0+(px-L0)/pw*(d1-d0);let i=0;while(i<A.length-1&&A[i].d<d)i++;const s=A[i];
    tip.innerHTML=`<b>${(s.d/1000).toFixed(2)} km · ${fmtTime(s.t)}</b>`+panels.map(pn=>`<div><i style="background:${pn.col}"></i>${pn.n}: <b>${Math.round(pn.vals[i])}</b> ${pn.u}</div>`).join('');
    tip.classList.remove('hidden');tip.style.left=Math.min(px+12,w-150)+'px';tip.style.top='8px';
    c.__line=px;};
  c.onmousemove=move;c.ontouchmove=e=>{move(e);};c.onmouseleave=()=>tip.classList.add('hidden');}
function drawZones(sum){const c=$('svZones');const [x,w,h]=prepCanvas(c);const tot=sum.zt.reduce((a,b)=>a+b,0)||1,mxf=Math.max(...sum.zt)/tot||1,rowH=(h-6)/ZONES.length,L0=110;
  x.font='600 11.5px Fredoka,system-ui';x.textBaseline='middle';
  ZONES.forEach((z,k)=>{const y=3+k*rowH,f=sum.zt[k]/tot,bw=Math.max(f>0?4:0,f/mxf*(w-L0-100));
    x.fillStyle='#1e0f3a';x.textAlign='right';x.fillText(z.n,L0-8,y+rowH/2);
    x.fillStyle=z.c;x.strokeStyle='#1e0f3a';x.lineWidth=1.5;if(bw>0){x.beginPath();x.roundRect?x.roundRect(L0,y+3,bw,rowH-6,4):x.rect(L0,y+3,bw,rowH-6);x.fill();x.stroke();}
    x.fillStyle='#4a3d5c';x.textAlign='left';x.fillText(Math.round(f*100)+' % · '+fmtTime(sum.zt[k]),L0+bw+6,y+rowH/2);});}
function drawCurve(sum){const c=$('svCurve');const [x,w,h]=prepCanvas(c);const cv=sum.curve,mx=Math.max(S.ftp*1.2,...cv.map(q=>q.p||0)),L0=8,B=22,bw=(w-L0*2)/cv.length;
  x.font='600 11px Fredoka,system-ui';x.textAlign='center';
  const fy=h-B-(S.ftp/mx)*(h-B-18);x.setLineDash([5,4]);x.strokeStyle='rgba(30,15,58,.5)';x.beginPath();x.moveTo(0,fy);x.lineTo(w,fy);x.stroke();x.setLineDash([]);x.fillStyle='#6b6577';x.textAlign='left';x.fillText('FTP',2,fy-6);x.textAlign='center';
  cv.forEach((q,k)=>{const cx=L0+bw*k+bw/2;x.fillStyle='#4a3d5c';x.textBaseline='top';x.fillText(q.l,cx,h-B+5);
    if(q.p===null){x.fillStyle='#b8b2a6';x.textBaseline='bottom';x.fillText('–',cx,h-B-2);return;}
    const bh=(q.p/mx)*(h-B-18),z=zoneOf(q.p);x.fillStyle=z>=0?ZONES[z].c:'#ccc';x.strokeStyle='#1e0f3a';x.lineWidth=1.5;x.beginPath();x.roundRect?x.roundRect(cx-bw*0.34,h-B-bh,bw*0.68,bh,[4,4,0,0]):x.rect(cx-bw*0.34,h-B-bh,bw*0.68,bh);x.fill();x.stroke();
    x.fillStyle='#1e0f3a';x.textBaseline='bottom';x.fillText(Math.round(q.p),cx,h-B-bh-2);});}
function drawTrack(){const c=$('svMap');drawMap(c,{mode:'route',big:true});const A=REC.s;if(A.length<2)return;
  // gefahrene Spur nach Tempo eingefärbt darüberlegen
  const [x,w,h]=[c.getContext('2d'),c.clientWidth,c.clientHeight];let a=1e9,b=-1e9,c2=1e9,d=-1e9;for(let i=0;i<N;i+=8){a=Math.min(a,RX[i]);b=Math.max(b,RX[i]);c2=Math.min(c2,RZ[i]);d=Math.max(d,RZ[i]);}
  const cx=(a+b)/2,cz=(c2+d)/2,span=Math.max(b-a,(d-c2)*w/h)*1.12,sc=w/span,P=(px,pz)=>[w/2+(px-cx)*sc,h/2+(pz-cz)*sc],vmax=Math.max(...A.map(s=>s.v))||1;
  x.lineWidth=4;x.lineCap='round';for(let i=1;i<A.length;i++){const p0=P(A[i-1].x,A[i-1].z),p1=P(A[i].x,A[i].z);if(Math.hypot(p1[0]-p0[0],p1[1]-p0[1])>40)continue;
    const t=A[i].v/vmax;x.strokeStyle=`hsl(${200-200*t},85%,48%)`;x.beginPath();x.moveTo(...p0);x.lineTo(...p1);x.stroke();}
  x.font='600 11px Fredoka,system-ui';x.fillStyle='#1e0f3a';x.textAlign='left';x.textBaseline='bottom';x.fillText('Spur nach Tempo: blau langsam → rot schnell',8,h-6);}
// TCX-Datei (für Strava, Garmin Connect, TrainingPeaks)
function exportTcx(){const A=REC.s;if(!A.length)return;const t0=REC.start,iso=t=>new Date(t0+t*1000).toISOString(),sum=rideSummary();
  const pts=A.map(s=>`<Trackpoint><Time>${iso(s.t)}</Time><AltitudeMeters>${s.h}</AltitudeMeters><DistanceMeters>${s.d}</DistanceMeters>${s.hr?`<HeartRateBpm><Value>${s.hr}</Value></HeartRateBpm>`:''}<Cadence>${s.c}</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Speed>${s.v}</Speed><Watts>${s.p}</Watts></TPX></Extensions></Trackpoint>`).join('\n');
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>${iso(0)}</Id><Lap StartTime="${iso(0)}"><TotalTimeSeconds>${sum.time}</TotalTimeSeconds><DistanceMeters>${sum.dist}</DistanceMeters><Calories>${Math.round(sum.kcal)}</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>\n${pts}\n</Track></Lap><Notes>Kalea Ride – ${ROUTE.name} (virtuell)</Notes></Activity></Activities></TrainingCenterDatabase>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([xml],{type:'application/vnd.garmin.tcx+xml'}));a.download=`KaleaRide_${new Date(t0).toISOString().slice(0,10)}_${ROUTE.id}.tcx`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}

/* ================= Online fahren (MQTT über öffentliche WebSocket-Broker) ================= */
const NET={client:null,room:null,id:null,host:false,info:null,peers:new Map(),state:'off',hold:false,raceT0:0,fin:null,cd:0,lastPub:0,broker:'',rf:1,rg:0};
const BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://test.mosquitto.org:8081/mqtt'];
const NET_COLS=[0xeb567b,0x490cb8,0xe8463c,0x7ad35a,0xb06fe0,0xffd23f,0xff8fb8,0x2e7dd7];
function netPrefix(){return 'kaleaRide/v1/'+NET.room;}
function loadMqtt(){return new Promise((res,rej)=>{if(window.mqtt)return res();const sc=document.createElement('script');sc.src='https://unpkg.com/mqtt@4.3.7/dist/mqtt.min.js';
  sc.onload=()=>res();sc.onerror=()=>rej(new Error('MQTT-Bibliothek nicht ladbar – Internet?'));document.head.appendChild(sc);});}
function netStatus(t,cls){const e=$('netState');if(e){e.textContent=t;e.className='netstate '+(cls||'');}}
function netName(){return ($('iNetName').value||'').trim().slice(0,16)||'Fahrer';}
function netCol(){return S.netCol!==undefined?S.netCol:NET_COLS[0];}
async function netConnect(){
  await loadMqtt();
  let list=BROKERS.slice();try{const b=localStorage.getItem('kalea_broker');if(b)list=[b];}catch(e){}
  for(const url of list){netStatus('Verbinde mit '+url.split('/')[2]+' …','busy');
    try{const c=await new Promise((res,rej)=>{const cl=mqtt.connect(url,{clientId:'kr_'+NET.id,clean:true,connectTimeout:7000,reconnectPeriod:3000,keepalive:20,
          will:{topic:netPrefix()+'/s/'+NET.id,payload:JSON.stringify({id:NET.id,left:true}),qos:0,retain:false}});
        const to=setTimeout(()=>{cl.end(true);rej(new Error('timeout'));},8000);
        cl.once('connect',()=>{clearTimeout(to);res(cl);});cl.once('error',e=>{clearTimeout(to);cl.end(true);rej(e);});});
      NET.broker=url;return c;}catch(e){console.warn('Broker',url,e&&e.message);}}
  throw new Error('Kein Online-Server erreichbar');}
async function netJoin(code,create){
  if(NET.client)netLeave();
  code=(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(!code){netStatus('Bitte einen Raumcode eingeben.','bad');return;}
  NET.room=code;NET.id=Math.random().toString(36).slice(2,10);NET.host=!!create;NET.peers.clear();NET.info=null;NET.fin=null;
  try{saveNetPrefs();NET.client=await netConnect();}catch(e){netStatus(e.message,'bad');NET.client=null;return;}
  const c=NET.client,P=netPrefix();
  c.on('message',(topic,buf)=>{let m;try{m=JSON.parse(buf.toString());}catch(e){return;}
    if(topic===P+'/room')onRoomInfo(m);else if(topic===P+'/ctl')onCtl(m);else if(topic.startsWith(P+'/s/'))onPeerState(m);});
  c.on('reconnect',()=>netStatus('Verbindung unterbrochen – verbinde neu …','busy'));c.on('connect',()=>{if(NET.state!=='off')netStatus('Online · Raum '+NET.room,'ok');});
  c.subscribe([P+'/room',P+'/ctl',P+'/s/+'],{qos:0});
  if(create){NET.info={host:NET.id,world:WORLD,route:ROUTE.id,routeName:ROUTE.name,mode:$('iNetMode').value,laps:+$('iNetLaps').value,rubber:$('iNetRubber').checked,state:'lobby',v:1};publishRoom();}
  NET.state='on';netStatus('Online · Raum '+NET.room+(create?' (du bist Gastgeber)':''),'ok');
  if(!create)setTimeout(()=>{if(!NET.info&&NET.state==='on')netStatus('Raum '+NET.room+' gefunden? Noch kein Gastgeber – warte …','busy');},4000);
  $('netCode').textContent=NET.room;updateNetUi();try{localStorage.setItem('kalea_net_room',JSON.stringify({room:NET.room,host:NET.host,ts:Date.now()}));}catch(e){}
  applyBotVis();}
function publishRoom(){if(NET.client&&NET.host&&NET.info)NET.client.publish(netPrefix()+'/room',JSON.stringify(NET.info),{qos:1,retain:true});}
function netLeave(){if(!NET.client)return;try{NET.client.publish(netPrefix()+'/s/'+NET.id,JSON.stringify({id:NET.id,left:true}));if(NET.host)NET.client.publish(netPrefix()+'/room','',{retain:true});NET.client.end(false);}catch(e){}
  NET.client=null;NET.state='off';NET.hold=false;NET.rf=1;NET.rg=0;for(const p of NET.peers.values())if(p.obj)scene.remove(p.obj);NET.peers.clear();NET.info=null;
  applyBotVis();try{localStorage.removeItem('kalea_net_room');}catch(e){}netStatus('Offline','');$('netBanner').classList.add('hidden');updateNetUi();}
function sameTrack(m){return m.w===WORLD&&m.r===ROUTE.id;}
function onRoomInfo(m){if(!m||!m.host){if(!NET.host&&NET.info){netStatus('Der Gastgeber hat den Raum geschlossen.','bad');NET.info=null;NET.hold=false;updateNetUi();}return;}
  NET.info=m;if(m.host===NET.id)NET.host=true;
  const same=m.world===WORLD&&m.route===ROUTE.id;
  if(!same){netStatus(`Raum ${NET.room} fährt „${m.routeName}“ (${m.world==='ulm'?'Ulm':'Kalea'}) – bitte wechseln.`,'busy');}
  else netStatus('Online · Raum '+NET.room+(NET.host?' (du bist Gastgeber)':'')+' · '+(m.mode==='race'?'Rennen über '+m.laps+(m.laps>1?' Runden':' Runde'):'Gruppenfahrt'+(m.rubber?' mit Gummiband 🪢':'')),'ok');
  if(m.mode==='race'&&m.state==='lobby'&&same&&S.started&&!NET.fin){NET.hold=true;holdAtStart();}
  if(m.mode!=='race'||m.state==='done')NET.hold=false;
  updateNetUi();}
function onCtl(m){if(!m||!m.type)return;
  if(m.type==='countdown'&&NET.info&&sameTrack({w:NET.info.world,r:NET.info.route})){NET.cd=performance.now()+m.secs*1000;NET.hold=true;holdAtStart();showNetBanner();}}
function onPeerState(m){if(!m||!m.id||m.id===NET.id)return;
  if(m.left){const p=NET.peers.get(m.id);if(p&&p.obj)scene.remove(p.obj);NET.peers.delete(m.id);updateNetUi();return;}
  let p=NET.peers.get(m.id);const now=performance.now();
  if(!p){p={id:m.id,disp:m.d,obj:null,lat:((parseInt(m.id,36)%9)-4)*0.55,phase:0,wheel:0};NET.peers.set(m.id,p);updateNetUi();}
  Object.assign(p,{n:m.n,col:m.col,w:m.w,r:m.r,d:m.d,v:m.v,p:m.p,wkg:m.wkg,cad:m.c,fin:m.fin,recv:now,lap:m.lap});
  if(sameTrack(m)&&!p.obj){p.obj=makeRider(m.col||0x490cb8,'🌐 '+(m.n||'?'),0x20232a);toonify(p.obj);}
  if(!sameTrack(m)&&p.obj){scene.remove(p.obj);p.obj=null;}}
function holdAtStart(){if(!S.started)return;S.dist=0;S.v=0;S.lastH=null;KOM.act=null;}
function netStep(dt,now){
  if(NET.state!=='on')return;
  {const I=NET.info,lobby=I&&I.mode==='race'&&I.state==='lobby'&&!NET.raceT0&&!NET.cd&&I.world===WORLD&&I.route===ROUTE.id&&S.started;
    if(lobby&&!NET.hold){NET.hold=true;holdAtStart();}
    if(lobby&&now-(NET.lobbyMsg||0)>2000){NET.lobbyMsg=now;status(NET.host?'Rennen: Menü öffnen und „Rennen starten“ drücken, sobald alle da sind.':'Warte auf den Start durch den Gastgeber …');}
    if(!lobby&&NET.lobbyMsg){NET.lobbyMsg=0;status('');}}
  // Countdown / Start
  if(NET.cd){const left=(NET.cd-now)/1000;if(left<=0){NET.cd=0;NET.hold=false;NET.raceT0=now;NET.fin=null;S.dist=0;S.v=Math.max(S.v,0);beep(880,0.35);showNetBanner('LOS!');setTimeout(()=>$('netBanner').classList.add('hidden'),1500);
      if(NET.host&&NET.info){NET.info.state='running';publishRoom();}}
    else{showNetBanner(Math.ceil(left));if(Math.ceil(left)!==NET.lastBeep){NET.lastBeep=Math.ceil(left);if(left<=3.05)beep(440,0.15);}}}
  // Ziel
  const race=NET.info&&NET.info.mode==='race'&&NET.raceT0&&!NET.hold;
  if(race&&!NET.fin&&S.dist>=NET.info.laps*L){NET.fin=(now-NET.raceT0)/1000;beep(660,0.2);setTimeout(()=>beep(990,0.4),220);showRaceResult();}
  // Fremde Fahrer bewegen (Vorhersage + weiches Nachziehen)
  for(const p of NET.peers.values()){if(now-p.recv>12000){if(p.obj)scene.remove(p.obj);NET.peers.delete(p.id);updateNetUi();continue;}
    const tgt=p.d+p.v*(now-p.recv)/1000;p.disp+=p.v*dt;p.disp+=(tgt-p.disp)*Math.min(1,dt*2.5);if(Math.abs(tgt-p.disp)>80)p.disp=tgt;
    if(p.obj){placeRider(p.obj,p.disp,p.lat,p.v);p.phase+=(p.cad||0)/60*Math.PI*2*dt;p.wheel+=p.v/0.335*dt;if(p.obj.position.distanceToSquared(camera.position)<200*200)animRider(p.obj,p.phase,p.wheel,{v:p.v,w:p.wkg||0,g:gradeAt(p.disp)});}}
  netRubber(dt);
  // eigenen Zustand senden (2× pro Sekunde)
  if(NET.client&&now-NET.lastPub>480){NET.lastPub=now;
    const m={id:NET.id,n:netName(),col:netCol(),w:WORLD,r:ROUTE.id,d:Math.round(S.dist*10)/10,v:+(S.v*NET.rf).toFixed(2),p:Math.round(T.pedaling?S.power:0),wkg:+(S.power/S.mass).toFixed(1),c:Math.round(S.cadence),lap:Math.floor(S.dist/L)+1,fin:NET.fin};
    NET.client.publish(netPrefix()+'/s/'+NET.id,JSON.stringify(m),{qos:0});}
  if(now-(NET.uiT||0)>1000){NET.uiT=now;updateNetUi();}}
// Gummiband (nur Gruppenfahrt, vom Gastgeber eingeschaltet): Wer hinter der Gruppe ist, kommt pro Meter Tempo etwas
// weiter voran, wer vorne wegfährt, etwas weniger – so bleiben alle zusammen, auch mit ganz verschiedener Leistung.
// Jeder rechnet das selbst aus (Abstand zur Gruppenmitte), Trainer-Widerstand und Watt bleiben echt.
function rubberOn(){const I=NET.info;return NET.state==='on'&&I&&I.mode==='group'&&!!I.rubber&&I.world===WORLD&&I.route===ROUTE.id&&!NET.hold&&!NET.cd;}
function netRubber(dt){let tgt=1,g=0;
  if(rubberOn()&&S.v>0.8){let sum=0,n=0;const now=performance.now();
    for(const p of NET.peers.values()){if(!sameTrack(p)||now-p.recv>6000||p.v<0.8)continue;const gp=p.disp-S.dist;if(Math.abs(gp)>1500)continue;sum+=gp;n++;} // Pause oder weit weg: zählt nicht
    if(n){g=sum/(n+1); // Abstand zur Gruppenmitte (du zählst mit)
      const e=Math.sign(g)*Math.max(0,Math.abs(g)-4); // nebeneinander/Windschatten: kein Eingriff
      tgt=clamp(1+e/20,0.6,1.6);}}
  NET.rf+=(tgt-NET.rf)*Math.min(1,dt*0.8);if(Math.abs(NET.rf-1)<0.002)NET.rf=1;NET.rg=g;}
function netStartRace(){if(!NET.host||!NET.info)return;NET.info.state='countdown';NET.info.mode=$('iNetMode').value;NET.info.laps=+$('iNetLaps').value;NET.info.rubber=$('iNetRubber').checked;publishRoom();
  NET.client.publish(netPrefix()+'/ctl',JSON.stringify({type:'countdown',secs:10}),{qos:1});onCtl({type:'countdown',secs:10});closeMenu();}
function netEndRide(){if(NET.client&&NET.host&&NET.info&&NET.info.mode==='race'){NET.info.state='done';publishRoom();}}
function showNetBanner(t){const b=$('netBanner');b.innerHTML=t===undefined?'':`<b>${t}</b><span>${t==='LOS!'?'Viel Erfolg!':'Rennen startet gleich'}</span>`;b.classList.remove('hidden');}
function raceRanking(){const rows=[{n:netName()+' (du)',me:true,fin:NET.fin,d:S.dist,col:netCol()}];
  for(const p of NET.peers.values())if(sameTrack(p))rows.push({n:p.n,fin:p.fin,d:p.d,col:p.col});
  return rows.sort((a,b)=>(a.fin&&b.fin)?a.fin-b.fin:a.fin?-1:b.fin?1:b.d-a.d);}
function showRaceResult(){const r=raceRanking(),b=$('komBanner');b.classList.remove('lap');
  b.innerHTML=`<div class="kb-t">ZIEL · ${ROUTE.name.toUpperCase()}</div><div class="kb-time">${fmtTime(NET.fin)}</div><div class="kb-pb new">Platz ${r.findIndex(x=>x.me)+1} von ${r.length}</div>
    <table class="kt" style="margin-top:6px;background:#fff;border-radius:8px">${r.map((x,i)=>`<tr><td>${i+1}.</td><td>${x.n}</td><td><b>${x.fin?fmtTime(x.fin):'unterwegs · '+(x.d/1000).toFixed(1)+' km'}</b></td></tr>`).join('')}</table>`;
  b.classList.remove('hidden');b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');KOM.shownT=performance.now()+6000;confetti();}
function netDraftCheck(d){for(const p of NET.peers.values()){if(!p.obj)continue;const g=p.disp-d;if(g>0.6&&g<7)return true;}return false;}
function updateNetUi(){
  const on=NET.state==='on',info=NET.info,same=info&&info.world===WORLD&&info.route===ROUTE.id;
  $('netOff').classList.toggle('hidden',on);$('netOn').classList.toggle('hidden',!on);
  if(!on)return;
  $('netSwitch').classList.toggle('hidden',!info||same);
  if(info&&!NET.host){$('iNetRubber').checked=!!info.rubber;$('iNetMode').value=info.mode;}
  $('iNetRubber').disabled=!!(info&&!NET.host);$('iNetMode').disabled=!!(info&&!NET.host);
  if(info&&!same)$('netSwitch').textContent=`Zur Route „${info.routeName}“ wechseln`;
  $('netStart').classList.toggle('hidden',!(NET.host&&same));
  $('netStart').textContent=info&&info.mode==='race'?(info.state==='running'?'Rennen neu starten':'Rennen starten (10 s Countdown)'):'Gemeinsam starten (10 s Countdown)';
  const list=[...NET.peers.values()];
  $('netPeers').innerHTML=`<li><i style="background:#${netCol().toString(16).padStart(6,'0')}"></i><b>${netName()}</b> (du)${NET.host?' · Gastgeber':''}</li>`+
    list.map(p=>`<li><i style="background:#${(p.col||0).toString(16).padStart(6,'0')}"></i><b>${p.n||'?'}</b>${info&&p.id===info.host?' · Gastgeber':''} · ${sameTrack(p)?((p.d/1000).toFixed(2)+' km · '+p.p+' W'):'<em>andere Strecke</em>'}</li>`).join('');}
function saveNetPrefs(){try{localStorage.setItem('kalea_net',JSON.stringify({name:$('iNetName').value,col:netCol(),bots:$('iNetBots').checked,rubber:$('iNetRubber').checked}));}catch(e){}}
let AC=null;function beep(f,dur){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.type='square';g.gain.value=0.06;o.connect(g);g.connect(AC.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur);o.stop(AC.currentTime+dur+0.02);}catch(e){}}
function wireNet(){
  let pr={};try{pr=JSON.parse(localStorage.getItem('kalea_net')||'{}');}catch(e){}
  $('iNetName').value=pr.name||'';S.netCol=pr.col!==undefined?pr.col:NET_COLS[Math.floor(Math.random()*NET_COLS.length)];$('iNetBots').checked=!!pr.bots;
  $('netCols').innerHTML=NET_COLS.map(c=>`<button class="colchip" data-c="${c}" style="background:#${c.toString(16).padStart(6,'0')}" aria-label="Trikotfarbe"></button>`).join('');
  const mark=()=>document.querySelectorAll('.colchip').forEach(b=>b.classList.toggle('on',+b.dataset.c===S.netCol));mark();
  document.querySelectorAll('.colchip').forEach(b=>b.onclick=()=>{S.netCol=+b.dataset.c;mark();saveNetPrefs();if(player){scene.remove(player);player=makeRider(S.netCol,null,0x1b1d22);toonify(player);}});
  $('iNetName').onchange=saveNetPrefs;$('iNetBots').onchange=()=>{saveNetPrefs();applyBotVis();};
  $('netCreate').onclick=()=>{const code=Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');netJoin(code,true);};
  $('netJoin').onclick=()=>netJoin($('iNetCode').value,false);
  $('netLeave').onclick=netLeave;$('netStart').onclick=netStartRace;
  $('iNetRubber').checked=pr.rubber!==false;
  $('iNetRubber').onchange=()=>{saveNetPrefs();if(NET.host&&NET.info){NET.info.rubber=$('iNetRubber').checked;publishRoom();onRoomInfo(NET.info);}};
  $('netSwitch').onclick=()=>{try{localStorage.setItem('kalea_net_room',JSON.stringify({room:NET.room,host:false,ts:Date.now()}));}catch(e){}switchTo(NET.info.world,NET.info.route);};
  $('netCopy').onclick=()=>{const t=NET.room;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{$('netCopy').textContent='Kopiert ✓';},()=>{});};
  updateNetUi();
  // nach einem Routenwechsel automatisch wieder in den Raum
  try{const r=JSON.parse(localStorage.getItem('kalea_net_room')||'null');if(r&&Date.now()-r.ts<30*60*1000){$('iNetCode').value=r.room;$('netDet').open=true;netJoin(r.room,!!r.host);}}catch(e){}
  if(pr.col!==undefined&&pr.col!==0xeb567b&&player){scene.remove(player);player=makeRider(S.netCol,null,0x1b1d22);toonify(player);}}

/* ================= Bluetooth ================= */
let bleQ=Promise.resolve();
function bleWrite(ch,data){bleQ=bleQ.then(()=>ch.writeValueWithResponse?ch.writeValueWithResponse(data):ch.writeValue(data)).catch(e=>console.warn('BLE write',e));return bleQ;}
function setDot(k,state,text){$('d'+k).className='dot '+state;$('s'+k).textContent=text;}
function status(msg){$('status').textContent=msg||'';}

// ---- Trainer (FTMS bevorzugt, sonst Cycling Power) ----
const T={speed:null,speedAt:0,acc:0,hasCad:false,cadAt:0,pedaling:true,coastT:0,startT:-1e9,startSoft:0,dev:null,cp:null,mode:null,lastData:0,lastSent:null,lastSendT:0,crank:null,retries:0};
async function connectTrainer(){
  if(!navigator.bluetooth)return;
  try{setDot('Trainer','busy','Gerät auswählen …');
    T.dev=await navigator.bluetooth.requestDevice({filters:[{services:[0x1826]},{services:[0x1818]},{namePrefix:'KICKR'}],optionalServices:[0x1826,0x1818]});
    T.dev.addEventListener('gattserverdisconnected',onTrainerLost);await setupTrainer();
  }catch(e){setDot('Trainer','off','Nicht verbunden'+(e.name==='NotFoundError'?'':' – '+e.message));T.dev=null;}
}
async function setupTrainer(){
  setDot('Trainer','busy','Verbinde …');
  const server=await T.dev.gatt.connect();let ftms=null;
  try{ftms=await server.getPrimaryService(0x1826);}catch(e){}
  if(ftms){
    const ibd=await ftms.getCharacteristic(0x2AD2);await ibd.startNotifications();
    ibd.addEventListener('characteristicvaluechanged',e=>parseIBD(e.target.value));
    try{const cp=await ftms.getCharacteristic(0x2AD9);await cp.startNotifications();
      cp.addEventListener('characteristicvaluechanged',e=>onCP(e.target.value));T.cp=cp;
      await bleWrite(cp,new Uint8Array([0x00]));await bleWrite(cp,new Uint8Array([0x07]));T.lastSent=null;
    }catch(e){T.cp=null;console.warn(e);}
    T.mode='ftms';
  }else{
    const cps=await server.getPrimaryService(0x1818),ch=await cps.getCharacteristic(0x2A63);
    await ch.startNotifications();ch.addEventListener('characteristicvaluechanged',e=>parseCPS(e.target.value));T.mode='cps';T.cp=null;
  }
  T.retries=0;T.lastData=performance.now();
  setDot('Trainer','on',(T.dev.name||'Trainer')+(T.cp?' · steuerbar (FTMS)':' · nur Leistungsdaten'));status('');
}
async function onTrainerLost(){T.cp=null;setDot('Trainer','busy','Verbindung verloren – verbinde neu …');status('Trainer getrennt – Neuverbindung …');
  while(T.dev&&T.retries<5){T.retries++;await new Promise(r=>setTimeout(r,2000));try{await setupTrainer();return;}catch(e){}}
  setDot('Trainer','off','Getrennt – bitte neu verbinden');status('Trainer getrennt.');}
function parseIBD(dv){try{let o=0;const f=dv.getUint16(o,true);o+=2;
  if(!(f&1)){const nv=dv.getUint16(o,true)/360,nt=performance.now();
    if(T.speed!==null&&nt-T.speedAt>50&&nt-T.speedAt<2000){const a=(nv-T.speed)/((nt-T.speedAt)/1000);T.acc=T.acc*0.6+a*0.4;}
    T.speed=nv;T.speedAt=nt;o+=2;} if(f&2)o+=2;
  if(f&4){if(!CS.dev){S.cadence=dv.getUint16(o,true)/2;T.hasCad=true;T.cadAt=performance.now();}o+=2;}
  if(f&8)o+=2; if(f&16)o+=3; if(f&32)o+=2;
  if(f&64){S.power=Math.max(0,dv.getInt16(o,true));o+=2;}
  if(f&128)o+=2; if(f&256)o+=5;
  if(f&512){const hr=dv.getUint8(o);o+=1;if(hr>0&&!HR.dev)S.hr=hr;}
  T.lastData=performance.now();}catch(e){}}
function parseCPS(dv){try{let o=0;const f=dv.getUint16(o,true);o+=2;S.power=Math.max(0,dv.getInt16(o,true));o+=2;
  if(f&1)o+=1;if(f&4)o+=2;if(f&16)o+=6;
  if(f&32){const rev=dv.getUint16(o,true),tm=dv.getUint16(o+2,true);
    if(T.crank){const dr=(rev-T.crank.rev+65536)%65536,dt=((tm-T.crank.tm+65536)%65536)/1024;
      if(dt>0)S.cadence=clamp(dr/dt*60,0,200);else if(performance.now()-T.crank.at>2500)S.cadence=0;}
    if(!T.crank||rev!==T.crank.rev)T.crank={rev,tm,at:performance.now()};}
  T.lastData=performance.now();}catch(e){}}
function onCP(dv){const b=new Uint8Array(dv.buffer,dv.byteOffset,dv.byteLength);
  if(b[0]===0x80&&b[2]!==0x01)console.warn('FTMS Control Point: Befehl 0x'+b[1].toString(16)+' Ergebnis '+b[2]);}
function sendResistance(force){
  if(!T.cp||!S.riding||S.paused)return;
  const now=performance.now();
  if(ergActive()){const tw=targetWatts();
    if(!force&&T.lastErg===tw&&now-T.lastSendT<3000)return;
    const b=new DataView(new ArrayBuffer(3));b.setUint8(0,0x05);b.setInt16(1,clamp(tw,0,2000),true);
    T.pending=new Uint8Array(b.buffer);T.lastErg=tw;T.lastSent=null;T.lastSendT=now;pumpTrainer();return;}
  T.lastErg=null;
  const cmd=trainerGradeCmd();
  if(!force&&T.lastSent!==null&&Math.abs(cmd.grade-T.lastSent)<0.0008&&now-T.lastSendT<5000)return;
  const buf=new DataView(new ArrayBuffer(7));buf.setUint8(0,0x11);buf.setInt16(1,0,true);
  buf.setInt16(3,clamp(Math.round(cmd.grade*10000),-32768,32767),true);buf.setUint8(5,Math.round(cmd.crr*10000));buf.setUint8(6,Math.round(cmd.cw*100));
  T.pending=new Uint8Array(buf.buffer);T.lastSent=cmd.grade;T.lastSendT=now;pumpTrainer();
}
// Nur der jeweils neueste Befehl wird gesendet: schnelle Schaltvorgänge stauen sich nicht in einer Warteschlange.
async function pumpTrainer(){
  if(T.busy||!T.pending||!T.cp)return;T.busy=true;const data=T.pending;T.pending=null;
  try{await (T.cp.writeValueWithResponse?T.cp.writeValueWithResponse(data):T.cp.writeValue(data));}catch(e){console.warn('FTMS',e.message);}
  T.busy=false;if(T.pending)pumpTrainer();}
setInterval(()=>sendResistance(false),400);

// ---- Trittfrequenz-Sensor (optional, Cycling Speed & Cadence) ----
const CS={dev:null,crank:null};
async function connectCad(){if(!navigator.bluetooth)return;
  try{setDot('Cad','busy','Gerät auswählen …');CS.dev=await navigator.bluetooth.requestDevice({filters:[{services:['cycling_speed_and_cadence']}]});
    const sv=await CS.dev.gatt.connect(),svc=await sv.getPrimaryService('cycling_speed_and_cadence'),ch=await svc.getCharacteristic('csc_measurement');
    await ch.startNotifications();ch.addEventListener('characteristicvaluechanged',e=>parseCSC(e.target.value));
    CS.dev.addEventListener('gattserverdisconnected',()=>{setDot('Cad','off','Getrennt');CS.dev=null;CS.crank=null;});
    setDot('Cad','on',CS.dev.name||'Trittfrequenz-Sensor');
  }catch(e){CS.dev=null;setDot('Cad','off','Nicht verbunden');}}
function parseCSC(dv){try{const f=dv.getUint8(0);let o=1;if(f&1)o+=6;
  if(f&2){const rev=dv.getUint16(o,true),tm=dv.getUint16(o+2,true),now=performance.now();
    if(CS.crank){const dr=(rev-CS.crank.rev+65536)%65536,dt=((tm-CS.crank.tm+65536)%65536)/1024;
      if(dr>0&&dt>0){S.cadence=clamp(dr/dt*60,0,200);CS.crank={rev,tm,at:now};}
      else if(now-CS.crank.at>2000)S.cadence=0;}
    else CS.crank={rev,tm,at:now};
    T.hasCad=true;T.cadAt=now;}}catch(e){}}

// ---- Pulsgurt ----
const HR={dev:null};
async function connectHr(){if(!navigator.bluetooth)return;
  try{setDot('Hr','busy','Gerät auswählen …');HR.dev=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
    const s=await HR.dev.gatt.connect(),svc=await s.getPrimaryService('heart_rate'),ch=await svc.getCharacteristic('heart_rate_measurement');
    await ch.startNotifications();ch.addEventListener('characteristicvaluechanged',e=>{const v=e.target.value,f=v.getUint8(0);S.hr=f&1?v.getUint16(1,true):v.getUint8(1);});
    HR.dev.addEventListener('gattserverdisconnected',()=>{setDot('Hr','off','Getrennt');HR.dev=null;S.hr=0;});
    setDot('Hr','on',HR.dev.name||'Pulsgurt');
  }catch(e){HR.dev=null;setDot('Hr','off','Nicht verbunden');}}

// ---- Click-Schalter (v1 und v2) ----
// Click v1: ein Gerät, Dienst 00000001-19ca…, Tasten als Nachricht 0x37.
// Click v2: zwei Hälften (beide heißen im Auswahlfenster gleich), Dienst 0xFC82, Tasten als Bitmaske in Nachricht 0x23
// (Bit = 0 heißt gedrückt). Rechte Hälfte: + und A/B/Y/Z, linke Hälfte: − und Steuerkreuz.
const ZU={svcV1:'00000001-19ca-4651-86e5-fa29dcdd09d1',svcV2:'0000fc82-0000-1000-8000-00805f9b34fb',
  async:'00000002-19ca-4651-86e5-fa29dcdd09d1',rx:'00000003-19ca-4651-86e5-fa29dcdd09d1',tx:'00000004-19ca-4651-86e5-fa29dcdd09d1'};
const HANDSHAKE=[0x52,0x69,0x64,0x65,0x4f,0x6e];
// Standardbelegung v2: + (0x1000) oder Y (0x40) = schwerer · − (0x100) oder B (0x20) = leichter
const V2_UP=0x1000|0x40,V2_DOWN=0x100|0x20;
Z.pads=[];
function hex(b){return [...b].map(x=>x.toString(16).padStart(2,'0')).join(' ');}
function zwrite(ch,bytes){const data=new Uint8Array(bytes);
  bleQ=bleQ.then(()=>(ch.properties&&ch.properties.writeWithoutResponse&&ch.writeValueWithoutResponse)?ch.writeValueWithoutResponse(data):(ch.writeValueWithResponse?ch.writeValueWithResponse(data):ch.writeValue(data)))
    .catch(e=>clickLog('Schreibfehler: '+e.message));return bleQ;}
function clickStatus(extra){const on=Z.pads.filter(p=>p.connected);
  if(!on.length){setDot('Click','off',extra||'Nicht verbunden');$('bClick').textContent='Verbinden';updateClickHud();return;}
  const v=on.map(p=>(p.side?p.side+': ':'')+(p.version||'?')+(p.batt!=null?' · Akku '+p.batt+' %':'')).join(' | ');
  setDot('Click','on',(on.length===1?'1 Gerät':'2 Hälften')+' verbunden ('+v+')'+(extra?' · '+extra:''));updateClickHud();
  $('bClick').textContent=on.some(p=>p.version==='Click v2')&&on.length<2?'2. Hälfte verbinden':'Weiteres Gerät';}
async function connectClick(){if(!navigator.bluetooth)return;
  let pad=null;
  try{setDot('Click','busy','Gerät auswählen …');
    const dev=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'Zwift'}],optionalServices:[ZU.svcV2,ZU.svcV1,'battery_service','device_information']});
    if(Z.pads.some(p=>p.dev.id===dev.id&&p.connected)){clickStatus('dieses Gerät ist schon verbunden');return;}
    pad=Z.pads.find(p=>p.dev.id===dev.id);
    if(!pad){pad={dev,bits:0,prev:{plus:false,minus:false},version:null,connected:false,buttons:0};Z.pads.push(pad);
      dev.addEventListener('gattserverdisconnected',()=>onClickLost(pad));}
    await setupClick(pad);
  }catch(e){if(pad){pad.connected=false;}
    if(e.name==='NotFoundError'){clickStatus();return;}
    clickLog('Fehler: '+e.message);clickStatus(e.message);status('Click-Schalter: '+e.message);}}
async function setupClick(pad){
  setDot('Click','busy','Verbinde …');
  const server=await pad.dev.gatt.connect();
  let svc=null,isV2=false;
  try{svc=await server.getPrimaryService(ZU.svcV2);isV2=true;}catch(e){}
  if(!svc){try{svc=await server.getPrimaryService(ZU.svcV1);}catch(e){}}
  if(!svc){let found='';try{found=(await server.getPrimaryServices()).map(x=>x.uuid).join(', ');}catch(e){}
    clickLog('Gefundene Dienste: '+(found||'keine'));try{server.disconnect();}catch(e){}
    throw new Error('Der Schalt-Dienst ist auf diesem Click verborgen. Bitte Firmware in der Hersteller-App aktualisieren oder den Click dort einmal koppeln (siehe Hilfe unten).');}
  const a=await svc.getCharacteristic(ZU.async);await a.startNotifications();a.addEventListener('characteristicvaluechanged',e=>onClickMsg(pad,e.target.value,'async'));
  try{const tx=await svc.getCharacteristic(ZU.tx);await tx.startNotifications();tx.addEventListener('characteristicvaluechanged',e=>onClickMsg(pad,e.target.value,'sync'));}catch(e){clickLog('Hinweis: Sync-Kanal nicht abonnierbar ('+e.message+')');}
  const rx=await svc.getCharacteristic(ZU.rx);pad.rx=rx;pad.isV2=isV2;pad.version=isV2?'Click v2':'Click v1';
  if(isV2){await zwrite(rx,[...HANDSHAKE,0x02,0x03]);await new Promise(r=>setTimeout(r,250));await zwrite(rx,[0xFF,0x04,0x00]);}
  else await zwrite(rx,HANDSHAKE);
  pad.connected=true;pad.retries=0;pad.lastMsg=performance.now();clickLog('Verbunden: '+pad.version+' – Handshake gesendet');
  try{const bs=await server.getPrimaryService('battery_service'),bl=await bs.getCharacteristic('battery_level'),v=await bl.readValue();pad.batt=v.getUint8(0);clickLog('Akku: '+pad.batt+' %');
    try{await bl.startNotifications();bl.addEventListener('characteristicvaluechanged',e=>{pad.batt=e.target.value.getUint8(0);clickStatus();});}catch(e){}}catch(e){}
  clickStatus('drück + zum Testen');
  if(!S.vshift){S.vshift=true;applyShiftMode();saveSettings();}
}
async function onClickLost(pad){pad.connected=false;clickStatus('eine Hälfte getrennt – verbinde neu …');
  const nm=pad.side?'Click-Schalter ('+pad.side+')':'Click-Schalter';status(nm+' getrennt – verbinde neu …'+(pad.batt!=null&&pad.batt<25?' Akku war bei '+pad.batt+' %.':''));if(typeof toast==='function')toast('⚠️ '+nm+' getrennt');
  for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,2000));try{await setupClick(pad);return;}catch(e){clickLog('Neuverbindung fehlgeschlagen: '+e.message);}}
  Z.pads=Z.pads.filter(p=>p!==pad);clickStatus('getrennt – bitte neu verbinden');status((pad.side?'Click-Schalter ('+pad.side+')':'Click-Schalter')+' bleibt getrennt – Batterie prüfen und im Menü neu verbinden. Bis dahin: Tasten ↑/↓ oder −/+ am Bildschirm.');}
function varint(b,i){let r=0,m=1;while(i<b.length){const x=b[i++];r+=(x&0x7f)*m;m*=128;if(!(x&0x80))return [r,i];}return [0,-1];}
function parseProto(b){const o={};let i=0;while(i<b.length){const [key,n]=varint(b,i);if(n<0)break;i=n;const fn=Math.floor(key/8),wt=key%8;
  if(wt===0){const [v,n2]=varint(b,i);if(n2<0)break;o[fn]=v;i=n2;}else if(wt===2){const [len,n2]=varint(b,i);if(n2<0)break;i=n2+len;}
  else if(wt===5)i+=4;else if(wt===1)i+=8;else break;}return o;}
function clickLog(s){Z.log.unshift(new Date().toLocaleTimeString()+'  '+s);Z.log.length=Math.min(Z.log.length,60);$('clickLog').textContent=Z.log.join('\n');}
function lowestBit(x){for(let i=0;i<32;i++)if(x&(1<<i))return i;return -1;}
function doShift(act){shift(act==='up'?1:-1);}
function firstPress(pad){if(!pad.buttons++)clickStatus('Tasten funktionieren ✓');}
function onClickMsg(pad,dv,src){
  const b=new Uint8Array(dv.buffer,dv.byteOffset,dv.byteLength),hx=hex(b),now=performance.now();
  if(!b.length)return;
  const type=b[0];
  if(type!==0x15)clickLog((pad.isV2?'v2':'v1')+' '+src+': '+hx);
  // Antwort auf den Handshake: Handshake-Bytes + 2 Bytes (01 03 = Click v1, 02 03 = Click v2)
  if(b.length>=6&&HANDSHAKE.every((x,i)=>b[i]===x)){if(b.length>=8)pad.version=b[6]===2?'Click v2':(b[6]===1&&b[7]===3?'Click v1':pad.version);clickStatus('Handshake ok – drück + zum Testen');return;}
  if(src==='sync')return;
  const f=parseProto(b.subarray(1));
  if(Z.learn){finishLearn(pad,b,hx,type,f);return;}
  pad.lastMsg=now;pad.warned=false;
  if(type===0x19){if(f[1]!==undefined&&f[1]<=100){const old=pad.batt;pad.batt=f[1];if(old!==pad.batt)clickStatus();if(pad.batt<=15&&!pad.lowWarn){pad.lowWarn=true;status('Click-Schalter'+(pad.side?' ('+pad.side+')':'')+': Akku nur noch '+pad.batt+' % – bald CR2032 tauschen.');}}return;}
  if(type===0x15){pad.idleSeen=true;return;} // Leerlauf
  Z.idle.set(hx,now);
  for(const act of ['up','down']){const m=Z.learned[act];if(m&&m.kind==='hex'&&m.v===hx){if(now-Z.latch>150){doShift(act);Z.latch=now;firstPress(pad);}return;}}
  if(type===0x37){const plus=f[1]===0,minus=f[2]===0;
    if(plus&&!pad.prev.plus){shift(1);firstPress(pad);holdStart('up');HOLD.pad=pad;}if(minus&&!pad.prev.minus){shift(-1);firstPress(pad);holdStart('down');HOLD.pad=pad;}
    if(!plus&&!minus&&HOLD.pad===pad)holdStop();
    pad.prev.plus=plus;pad.prev.minus=minus;return;}
  if(type===0x23||type===0x07){if(f[1]===undefined)return;
    const pressed=((~f[1])>>>0)&0xFFFF,newly=(pressed&~pad.bits)>>>0;pad.bits=pressed;
    const L=Z.learned,up=L.up&&L.up.kind==='bit'?(1<<L.up.bit):V2_UP,down=L.down&&L.down.kind==='bit'?(1<<L.down.bit):V2_DOWN;
    if(HOLD.act&&HOLD.pad===pad&&!(pressed&(HOLD.act==='up'?up:down)))holdStop();
    if(!newly)return;
    if(!pad.side){if(newly&0x1000)pad.side='rechts (+)';else if(newly&0x100)pad.side='links (−)';if(pad.side)clickStatus();}
    if(newly&up){shift(1);firstPress(pad);holdStart('up');HOLD.pad=pad;}else if(newly&down){shift(-1);firstPress(pad);holdStart('down');HOLD.pad=pad;}
    else status('Click-Taste (Bit '+lowestBit(newly)+') hat noch keine Funktion – im Menü anlernen.');}
}
function startLearn(act){Z.learn=act;$('learnState').textContent=(act==='up'?'Schwerer':'Leichter')+'-Taste jetzt am Click drücken …';
  clearTimeout(Z.learnTimer);Z.learnTimer=setTimeout(()=>{if(Z.learn){Z.learn=null;$('learnState').textContent='Keine Taste erkannt. Kommen im Protokoll unten Daten an, wenn du drückst?';}},10000);}
function finishLearn(pad,b,hx,type,f){const act=Z.learn;let res=null;
  if(type===0x15||type===0x19)return;
  if(type===0x37){if(f[1]===0||f[2]===0)res={kind:'proto37'};else return;}
  else if((type===0x23||type===0x07)&&f[1]!==undefined){const p=((~f[1])>>>0)&0xFFFF;if(!p)return;res={kind:'bit',bit:lowestBit(p)};}
  else{const seen=Z.idle.get(hx);if(seen&&performance.now()-seen<8000)return;res={kind:'hex',v:hx};}
  Z.learned[act]=res.kind==='proto37'?null:res;Z.learn=null;clearTimeout(Z.learnTimer);saveSettings();
  $('learnState').textContent=(act==='up'?'Schwerer':'Leichter')+'-Taste gespeichert'+(res.kind==='bit'?' (Bit '+res.bit+').':'.');}

function updateClickHud(){const el=$('clickHud');if(!el)return;const on=Z.pads.filter(p=>p.connected);
  if(!Z.pads.length){el.classList.add('hidden');return;}el.classList.remove('hidden');
  el.innerHTML='🎮 '+Z.pads.map(p=>`<span class="${p.connected?'ok':'bad'}">${p.side?(p.side.startsWith('links')?'−':'+'):'●'}${p.batt!=null?' '+p.batt+'%':''}</span>`).join(' ');}
setInterval(()=>{const now=performance.now();for(const p of Z.pads){if(p.connected&&p.isV2&&p.idleSeen&&p.lastMsg&&now-p.lastMsg>45000&&!p.warned){p.warned=true;
  status('Click-Schalter'+(p.side?' ('+p.side+')':'')+' sendet seit 45 s nichts mehr. Batterie leer oder von der Hersteller-App gesperrt? Siehe Hilfe im Menü.');}}},5000);
/* ================= Schalten ================= */
let flashT=0;
function shift(d){if(ergActive()){ergNudge(d);if(!shift.ergHint){shift.ergHint=1;status('ERG ist an: Die Schalttasten ändern jetzt die Wattzahl, nicht den Gang. Taste E schaltet ERG aus.');setTimeout(()=>status(''),7000);}return;}
  if(!S.vshift&&!S.sim){if(!shift.realHint){shift.realHint=1;status('Du fährst mit normaler Kassette – geschaltet wird am Rad. (Umstellen: Menü → Geräte → Schalten)');setTimeout(()=>status(''),7000);}return;}
  const g=clamp(S.gear+d,0,GEARS.length-1);if(g===S.gear)return;sndShift(S.gear,g);S.gear=g;S.shiftT=performance.now();if(d>0)S.upT=S.shiftT;
  sendResistance(true);updateGear();
  const el=$('gearNum');el.classList.add('flash');clearTimeout(flashT);flashT=setTimeout(()=>el.classList.remove('flash'),120);}
// Dauerdruck: nach kurzer Pause weiter schalten, solange die Taste gehalten wird
const HOLD={act:null,t1:0,t2:0};
function holdStart(act){holdStop();if(!S.repeat)return;HOLD.act=act;HOLD.t0=performance.now();
  HOLD.t1=setTimeout(()=>{HOLD.t2=setInterval(()=>{if(performance.now()-HOLD.t0>4000){holdStop();return;}shift(act==='up'?1:-1);},S.repeat);},380);}
function holdStop(){clearTimeout(HOLD.t1);clearInterval(HOLD.t2);HOLD.act=null;}
function parseTeeth(str,min,max){return (String(str).match(/\d+/g)||[]).map(Number).filter(n=>n>=min&&n<=max);}
function bikeSetup(){
  const rings=[...new Set(parseTeeth(S.rings,20,70))].sort((a,b)=>a-b),cogs=[...new Set(parseTeeth(S.cassette,9,60))].sort((a,b)=>b-a);
  return {rings:rings.length?rings:[50],cogs:cogs.length?cogs:[17]};}
function allCombos(){const {rings,cogs}=bikeSetup(),out=[];
  rings.forEach((r,ri)=>cogs.forEach((c,ci)=>{const cross=rings.length>1&&((ri===rings.length-1&&ci<=1)||(ri===0&&ci>=cogs.length-2));
    out.push({r,c,ri,ci,ratio:r/c,cross});}));return out;}
// echte Schaltfolge: kleines Blatt von groß nach klein, dann aufs große Blatt wechseln (ohne Kreuzgänge)
function bikeSequence(){const {rings}=bikeSetup(),combos=allCombos().filter(x=>!x.cross);let seq=[];
  rings.forEach((r,ri)=>{const part=combos.filter(x=>x.ri===ri).sort((a,b)=>a.ratio-b.ratio);
    const last=seq.length?seq[seq.length-1].ratio:0;seq=seq.concat(part.filter(x=>x.ratio>last*1.01));});
  return seq;}
function nearestCombo(ratio){let best=null,bd=1e9;for(const x of allCombos()){const d=Math.abs(Math.log(x.ratio/ratio))+(x.cross?0.03:0);if(d<bd){bd=d;best=x;}}return best;}
function rebuildGears(keepRatio){
  const cur=keepRatio||GEARS[S.gear]||2.6;
  if(S.gearMode==='bike'){GEAR_COMBO=bikeSequence();GEARS=GEAR_COMBO.map(x=>x.ratio);}
  else{GEARS=VGEARS.slice();const seq=bikeSequence();
    GEAR_COMBO=GEARS.map(g=>{let best=seq[0],bd=1e9;for(const x of seq){const d=Math.abs(Math.log(x.ratio/g));if(d<bd){bd=d;best=x;}}return best||nearestCombo(g);});}
  let bi=0,bd=1e9;GEARS.forEach((g,i)=>{const d=Math.abs(Math.log(g/cur));if(d<bd){bd=d;bi=i;}});S.gear=bi;
  const {rings,cogs}=bikeSetup();
  $('ringsViz').innerHTML=rings.map(r=>`<i data-r="${r}">${r}</i>`).join('');
  const maxT=Math.max(...cogs);$('casViz').innerHTML=cogs.map(c=>`<i data-c="${c}" style="height:${Math.round(28+72*c/maxT)}%"></i>`).join('');
  const n=cogs.length;$('vCas').textContent=n+'-fach · '+Math.min(...cogs)+'–'+maxT+' Zähne'+(n<5?' – bitte alle Ritzel einzeln eingeben':'')+
    (S.gearMode==='bike'?' · ergibt '+GEARS.length+' virtuelle Gänge':'');
  updateGear();}
function updateGear(){
  if(!S.vshift&&!S.sim){updateRealGear(performance.now(),true);return;}
  const ratio=GEARS[S.gear],cb=GEAR_COMBO[S.gear];
  $('gearNum').textContent=S.gear+1;
  $('gearRatio').textContent='Übersetzung '+ratio.toFixed(2)+' · Entfaltung '+(ratio*PHYS.circ).toFixed(1)+' m';
  if(cb){const {cogs}=bikeSetup(),approx=S.gearMode!=='bike'&&Math.abs(cb.ratio/ratio-1)>0.015;
    $('realGear').innerHTML=`${approx?'≈ ':''}${cb.r} × ${cb.c}<small>Blatt ${cb.ri+1} · Ritzel ${cogs.length-cb.ci}/${cogs.length}${cb.cross?' · Kreuzgang':''}</small>`;
    for(const e of $('ringsViz').children)e.className=+e.dataset.r===cb.r?'a':'';
    for(const e of $('casViz').children){const c=+e.dataset.c;e.className=c===cb.c?'a':'';}}}

// Normale Kassette: Schalten oder virtuell (Click-Schalter). Ohne virtuelles Schalten schickt die App die echte Steigung.
function applyShiftMode(){document.body.classList.toggle('realshift',!S.vshift);const sel=$('iShiftMode');if(sel)sel.value=S.vshift?'click':'real';
  $('vShiftMode').textContent=S.vshift?'Das Rad bleibt am Trainer in einem festen Gang (festes Trainer-Ritzel). Geschaltet wird mit dem Click oder den Tasten ↑/↓.'
    :'Du schaltest ganz normal am Rad. Die App schickt die Steigung, der Trainer rechnet den Widerstand selbst. Der aufgelegte Gang wird angezeigt.';
  RGEAR.r.length=0;updateGear();}
// aufgelegten Gang aus Trainer-Tempo ÷ Trittfrequenz erkennen (nur Anzeige)
const RGEAR={r:[]};
function updateRealGear(now,force){
  let cb=null,m=0;
  if(T.speed!==null&&now-T.speedAt<2500&&T.pedaling&&S.cadence>=40){RGEAR.r.push(T.speed/(S.cadence/60*2.096));if(RGEAR.r.length>6)RGEAR.r.shift();
    m=RGEAR.r.slice().sort((a,b)=>a-b)[RGEAR.r.length>>1];cb=nearestCombo(m);}
  else RGEAR.r.length=0;
  const key=cb?cb.r+'x'+cb.c:'';if(!force&&key===RGEAR.key)return;RGEAR.key=key;
  const {cogs}=bikeSetup();
  $('gearNum').textContent=cb?cogs.length-cb.ci:'–';
  $('realGear').innerHTML=cb?`${cb.r} × ${cb.c}<small>Blatt ${cb.ri+1} · Ritzel ${cogs.length-cb.ci}/${cogs.length}</small>`:'–<small>Gang wird beim Treten erkannt</small>';
  $('gearRatio').textContent=cb?'Übersetzung '+cb.ratio.toFixed(2)+' · Entfaltung '+(cb.ratio*PHYS.circ).toFixed(1)+' m':'Schalten am Rad';
  for(const e of $('ringsViz').children)e.className=cb&&+e.dataset.r===cb.r?'a':'';
  for(const e of $('casViz').children)e.className=cb&&+e.dataset.c===cb.c?'a':'';}

/* ================= HUD ================= */
function fmtTime(s){s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');}
let hudT=0,ridersT=0;
function updateHud(now){
  if(now-hudT<120)return;hudT=now;
  const r=roadAt(S.dist);
  $('hPow').textContent=Math.round(T.pedaling?S.power:0);$('hCad').textContent=Math.round(S.cadence);$('hSpd').textContent=(S.v*3.6).toFixed(1);$('hSpdL').textContent=NET.rf!==1?(NET.rf>1?'🪢 Tempo +':'🪢 Tempo −')+Math.round(Math.abs(NET.rf-1)*100)+' %':'Tempo';
  $('hHr').textContent=S.hr?S.hr:'–';$('hDist').textContent=(S.dist/1000).toFixed(2);$('hTime').textContent=fmtTime(S.elapsed);$('hElev').textContent=Math.round(S.climb);
  const gp=r.grade*100,ge=$('grade'),ef=gradeAt(S.dist)*100,fmt=x=>(x>=0?'':'−')+Math.abs(x).toFixed(1)+'%';
  ge.innerHTML=fmt(gp)+(S.smooth&&Math.abs(ef-gp)>0.4?`<small>gefühlt ${fmt(ef)}</small>`:'');
  ge.style.background=gp>8?'#ff8a80':gp>4?'#ffb35c':gp>1?'#ffe98a':gp<-1?'#a8e3ff':'#fffaf0';
  {const vw=S.sim||!S.vshift?null:wheelSpeed();$('gearHint').textContent=(vw!==null&&T.pedaling&&S.v>4&&vw<S.v*0.85)?'Freilauf – hochschalten ↑':'';}
  if(!S.vshift&&!S.sim)updateRealGear(now);
  updateKomHud(now);if(now-ridersT>500){ridersT=now;updateRiders();drawProfile();updateErgUi();updateWorkoutHud();}
}
function updateRiders(){
  const rows=BOTS.filter(b=>b.active).map(b=>({n:b.name,gap:b.dist-S.dist,w:b.wkg})).concat([{n:'Du',gap:0,me:true,w:S.power/S.mass}]);
  if(NET.state==='on')for(const q of NET.peers.values())if(q.obj)rows.push({n:'🌐 '+q.n,gap:q.disp-S.dist,w:q.wkg,net:true});
  rows.sort((a,b)=>b.gap-a.gap);
  $('riders').innerHTML=(rubberOn()?`<div class="r rb"><span>🪢 Gummiband</span><span class="g">${NET.rf>1.005?'holt auf':NET.rf<0.995?'wartet':'zusammen'}</span></div>`:'')+rows.slice(0,12).map(r=>`<div class="r ${r.me?'me':''}${r.net?' net':''}"><span>${r.n}</span><span class="g">${r.me?r.w.toFixed(1)+' W/kg':(r.gap>0?'+':'−')+Math.abs(Math.round(r.gap))+' m'}</span></div>`).join('');
}
function drawProfile(){
  const c=$('profile'),dpr=Math.min(devicePixelRatio,2),w=c.clientWidth,h=c.clientHeight;
  if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr;c.height=h*dpr;}
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  let mn=1e9;for(let i=0;i<N;i+=8)mn=Math.min(mn,RH[i]);const lo=IS_ULM?mn-8:0,mh=Math.max(90,(MAXH-lo)*1.15),Y=v=>h-2-((v-lo)/mh)*(h-6);
  const grd=x.createLinearGradient(0,0,0,h);grd.addColorStop(0,'#b54bc4');grd.addColorStop(1,'#f7c6d3');
  x.beginPath();x.moveTo(0,h);const step=Math.max(1,Math.floor(N/w));
  for(let i=0;i<N;i+=step)x.lineTo(i/N*w,Y(RH[i]));x.lineTo(w,Y(RH[0]));x.lineTo(w,h);x.closePath();x.fillStyle=grd;x.fill();x.lineWidth=2;x.strokeStyle='#1e0f3a';x.stroke();
  const pos=d=>((d%L)+L)%L/L*w;
  x.fillStyle='#ffffff';x.strokeStyle='#1e0f3a';x.lineWidth=1.5;for(const b of BOTS){if(!b.active)continue;const px=pos(b.dist);x.beginPath();x.arc(px,Y(roadAt(b.dist).h),3,0,7);x.fill();x.stroke();}
  const px=pos(S.dist);x.strokeStyle='#1e0f3a';x.lineWidth=2;x.setLineDash([4,3]);x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();x.setLineDash([]);
  x.fillStyle='#eb567b';x.beginPath();x.arc(px,Y(roadAt(S.dist).h),6,0,7);x.fill();x.lineWidth=2.5;x.stroke();
  const lap=Math.floor(Math.max(0,S.dist)/L)+1,d=((S.dist%L)+L)%L,i=Math.floor(d/ds)%N;
  x.font='600 11px Fredoka,system-ui';
  for(const c of CLIMBS){const x0=c.start/L*w,x1=c.end/L*w;x.fillStyle='#e8463c';x.fillRect(x0,h-5,x1-x0,5);if(x1>w)x.fillRect(0,h-5,x1-w,5);
    x.fillStyle='#1e0f3a';x.fillText('⛰ '+c.name,Math.min(x0,w-80),10);}
  const elev=Math.round(RH[i]+(IS_ULM?UY0:0)),inC=CLIMBS.find(c=>{const q=((d-c.start)%L+L)%L;return q<=c.len;});
  const nx=CLIMBS.map(c=>({c,dd:((c.start-d)%L+L)%L})).sort((a,b)=>a.dd-b.dd)[0];
  $('pLeft').textContent=`${ROUTE.name}${IS_ULM?' · '+RNAME[i]:''} · Runde ${lap} · ${(L/1000).toFixed(1)} km`;
  $('pRight').textContent=inC?`${inC.name}: noch ${((inC.len-(((d-inC.start)%L+L)%L))/1000).toFixed(2)} km · ${elev} m ü. NN`:
    nx?`${nx.c.name} in ${(nx.dd/1000).toFixed(1)} km (${(nx.c.len/1000).toFixed(1)} km, Ø ${(+nx.c.avg).toFixed(1)} %) · ${elev} m ü. NN`:`flach · ${elev} m ü. NN`;
}

/* ================= Töne: Fahrgeräusche (eigene Aufnahmen) & dezente Umgebung ================= */
// Rad: Schaltwerk, Umwerfer, Kette beim Treten, Freilauf beim Rollen (src/data/sounds.js). Umgebung wird erzeugt:
// Fahrtwind, Vögel, Wasser (Meer/Donau), Stadtrauschen in Ulm. Browser erlauben Ton erst nach einer Berührung/Taste.
const SND={ctx:null,ok:false,buf:{},bus:{},loops:{},nextBird:0,last:0,shiftT:0,cobble:0,lastD:null,nextStroke:0};
function sndB64(u){const b=atob(u.slice(u.indexOf(',')+1)),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a.buffer;}
function sndDecode(ab){return new Promise((res,rej)=>{try{const p=SND.ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);}catch(e){rej(e);}});}
function sndNoise(brown){const c=SND.ctx,b=c.createBuffer(1,c.sampleRate*3,c.sampleRate),d=b.getChannelData(0);let br=0,mx=0;
  for(let i=0;i<d.length;i++){const w=Math.random()*2-1;br=(br+0.02*w)/1.02;d[i]=brown?br:w;mx=Math.max(mx,Math.abs(d[i]));}
  for(let i=0;i<d.length;i++)d[i]*=0.5/mx;return b;}
function sndInit(){
  if(SND.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(e){} // iPhone: Musik läuft weiter
  try{SND.ctx=new AC();}catch(e){return;}
  const c=SND.ctx,gain=v=>{const n=c.createGain();n.gain.value=v;return n;};
  SND.bus.master=gain(0);SND.bus.bike=gain(0);SND.bus.amb=gain(0);
  SND.bus.master.connect(c.destination);SND.bus.bike.connect(SND.bus.master);SND.bus.amb.connect(SND.bus.master);
  const loop=(buf,type,f,bus,q)=>{const s=c.createBufferSource();s.buffer=buf;s.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q||0.7;
    const g=gain(0);s.connect(fl);fl.connect(g);g.connect(bus);s.start(0,Math.random()*buf.duration);return {s,f:fl,g};};
  const white=sndNoise(false),brown=sndNoise(true);SND.white=white;
  SND.loops.wind=loop(white,'bandpass',500,SND.bus.amb,0.6);
  SND.loops.roll=loop(white,'bandpass',400,SND.bus.bike,0.7); // Abrollen der Reifen
  // Kopfsteinpflaster: Rauschen, im Takt der Steine (ca. 14 cm) moduliert → Rattern
  {const src=c.createBufferSource();src.buffer=white;src.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=1100;
    const am=gain(0.5),lvl=gain(0),o=c.createOscillator(),od=gain(0.5);o.type='sawtooth';o.frequency.value=40;o.connect(od);od.connect(am.gain);
    src.connect(f);f.connect(am);am.connect(lvl);lvl.connect(SND.bus.bike);src.start();o.start();SND.loops.cobble={o,g:lvl};}SND.loops.water=loop(brown,'lowpass',700,SND.bus.amb);SND.loops.city=loop(brown,'lowpass',260,SND.bus.amb);
  if(typeof SOUNDS!=='undefined')Promise.all(Object.entries(SOUNDS).map(([k,u])=>sndDecode(sndB64(u)).then(b=>{SND.buf[k]=b;}).catch(()=>{}))).then(()=>{
    if(SND.buf.drive)SND.loops.drive=loop(SND.buf.drive,'lowpass',7000,SND.bus.bike);
    if(SND.buf.free)SND.loops.free=loop(SND.buf.free,'lowpass',4500,SND.bus.bike);});
  SND.ok=true;sndVolume();}
function sndUnlock(){sndInit();if(SND.ctx&&SND.ctx.state==='suspended'&&!document.hidden)SND.ctx.resume().catch(()=>{});}
['pointerdown','touchend','keydown'].forEach(e=>addEventListener(e,sndUnlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(!SND.ctx)return;if(document.hidden)SND.ctx.suspend().catch(()=>{});else SND.ctx.resume().catch(()=>{});});
function sndVolume(){const b=$('sndBtn');if(b){b.textContent=S.mute?'🔇':'🔊';b.title=S.mute?'Ton an (T)':'Ton aus (T)';}
  if(!SND.ok)return;const t=SND.ctx.currentTime;
  SND.bus.master.gain.setTargetAtTime(S.mute?0:1,t,0.05);SND.bus.bike.gain.setTargetAtTime(S.sndBike,t,0.05);SND.bus.amb.gain.setTargetAtTime(S.sndAmb,t,0.05);}
function toggleMute(){S.mute=!S.mute;saveSettings();sndVolume();}
function sndPlay(name,vol,rate){const b=SND.buf[name];if(!b||!SND.ok||SND.ctx.state!=='running')return;
  const s=SND.ctx.createBufferSource(),g=SND.ctx.createGain();s.buffer=b;s.playbackRate.value=rate||1;g.gain.value=vol;s.connect(g);g.connect(SND.bus.bike);s.start();}
// Schalten: hinten hoch/runter (je zwei Aufnahmen im Wechsel), beim Wechsel des Kettenblatts der Umwerfer
function sndShift(from,to){const now=performance.now(),quick=now-SND.shiftT<300;SND.shiftT=now;
  const a=GEAR_COMBO[from],b=GEAR_COMBO[to],ring=a&&b&&a.r!==b.r;
  sndPlay(ring?(b.r>a.r?'ringbig':'ringsmall'):(to>from?'up':'down')+(Math.random()<0.5?1:2),(ring?0.75:0.6)*(quick?0.6:1),0.96+Math.random()*0.08);}
// kurzes gefiltertes Rauschen mit fallender Tonhöhe: „Wusch“ (Vorbeifahren, kräftiger Tritt)
function sndBurst(t0,dur,f0,f1,vol,pan,bus){if(vol<0.002)return;const c=SND.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
  s.buffer=SND.white;f.type='bandpass';f.Q.value=1.1;f.frequency.setValueAtTime(f0,t0);f.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+dur*0.4);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f);f.connect(g);if(pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;g.connect(p);p.connect(bus);}else g.connect(bus);
  s.start(t0,Math.random()*2,dur+0.05);}
// Vorbeifahren an Leitpfosten (alle 50 m, beide Seiten) und Ulmer Laternen (alle 32 m, abwechselnd) – kurz vor dem Objekt auslösen
function sndPassBy(d0,d1,v){const W=(pan,vol)=>sndBurst(SND.ctx.currentTime+0.01,clamp(2.4/v,0.16,0.4),2400,650,vol*sat((v-4)/10),pan,SND.bus.amb);
  const ps=Math.round(50/ds);for(let k=Math.ceil(d0/(ps*ds));k*ps*ds<=d1;k++){const i=(k*ps)%N;if(IS_ULM&&riverDist(RX[i],RZ[i]).d<RIVER_HW+10)continue;W(-0.75,0.05);W(0.75,0.05);}
  if(IS_ULM){const ls=Math.round(32/ds);for(let k=Math.ceil(d0/(ls*ds));k*ls*ds<=d1;k++){const i=(k*ls)%N;if(ulmZone(RX[i],RZ[i]).d<0.3)continue;W((Math.floor(i/ls)%2)?0.8:-0.8,0.07);}}}
function sndBirds(){const c=SND.ctx,t0=c.currentTime+0.05,n=2+Math.floor(Math.random()*4),f0=rnd(2600,4200),g=c.createGain();g.gain.value=0.07;
  if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=rnd(-0.8,0.8);g.connect(p);p.connect(SND.bus.amb);}else g.connect(SND.bus.amb);
  for(let i=0;i<n;i++){const o=c.createOscillator(),e=c.createGain(),st=t0+i*rnd(0.12,0.22),d=rnd(0.05,0.11),f=f0*rnd(0.9,1.15);
    o.frequency.setValueAtTime(f,st);o.frequency.exponentialRampToValueAtTime(f*rnd(1.2,1.6),st+d*0.6);o.frequency.exponentialRampToValueAtTime(f*0.85,st+d);
    e.gain.setValueAtTime(0,st);e.gain.linearRampToValueAtTime(1,st+0.01);e.gain.exponentialRampToValueAtTime(0.001,st+d);
    o.connect(e);e.connect(g);o.start(st);o.stop(st+d+0.02);}}
// alle 100 ms: Lautstärke und Tonhöhe der Schleifen an Tempo, Treten und Umgebung anpassen (weich überblendet)
function sndStep(now){if(now-SND.last<100)return;SND.last=now;
  const live=S.started&&S.riding&&!S.paused&&!REBUILD&&!!player&&$('setup').classList.contains('hidden')&&$('statsView').classList.contains('hidden');
  // Kopfsteinpflaster in der Ulmer Altstadt (auch für das Rubbeln der Kamera)
  {const zn=live&&IS_ULM?ulmZone(player.position.x,player.position.z):null,cb=zn&&zn.t==='alt'?sat((zn.d-0.8)/0.15):0;SND.cobble+=(cb-SND.cobble)*0.3;}
  if(!SND.ok||SND.ctx.state!=='running'){SND.lastD=null;return;}
  const t=SND.ctx.currentTime,L=SND.loops,set=(p,v,tc)=>p.setTargetAtTime(v,t,tc||0.25);
  const v=live?S.v:0,ped=live&&T.pedaling&&S.power>5&&(S.sim||S.cadence>15);
  // Abrollgeräusch: höher und lauter mit dem Tempo; auf Pflaster stattdessen Rattern im Takt der Steine
  set(L.roll.g.gain,0.1*sat(v/3)*(0.35+0.65*sat(v/15))*(1-0.6*SND.cobble),0.2);set(L.roll.f.frequency,260+v*32,0.3);
  set(L.cobble.g.gain,0.09*SND.cobble*sat(v/3),0.3);set(L.cobble.o.frequency,Math.max(8,v/0.14),0.2);
  // Kräftiges Treten: bei jedem Tritt (zwei pro Kurbelumdrehung) ein kurzes „Wusch“ der Reifen
  const hard=ped?sat((S.power/Math.max(120,S.ftp)-0.75)/0.6)*sat((v-2)/5):0;
  if(hard>0.02&&S.cadence>30){const per=30/S.cadence;
    if(!SND.nextStroke||SND.nextStroke<t)SND.nextStroke=t+0.02+(Math.PI-(S.legPhase%Math.PI))/Math.PI*per;
    while(SND.nextStroke<t+0.2){sndBurst(SND.nextStroke,Math.min(0.32,per*0.75),900+v*25,350+v*12,0.13*hard,0,SND.bus.bike);SND.nextStroke+=per;}}
  else SND.nextStroke=0;
  // Vorbeifahren: Leitpfosten, Laternen, andere Fahrer
  if(live&&SND.lastD!==null&&S.dist>SND.lastD&&S.dist-SND.lastD<60&&v>4)sndPassBy(SND.lastD+v*0.15,S.dist+v*0.15,v);
  SND.lastD=live?S.dist:null;
  if(live){const pass=(o,d,lat,ov)=>{const g=d-S.dist,pg=o._sg;o._sg=g;
      if(pg!==undefined&&(pg>0)!==(g>0)&&Math.abs(g)<5&&Math.abs(lat-0.8)<4)sndBurst(t+0.01,0.35,1700,500,0.11*(0.3+sat(Math.abs(ov-S.v)/3)),clamp((lat-0.8)/3,-0.9,0.9),SND.bus.amb);};
    for(const b of BOTS)if(b.active)pass(b,b.dist,b.lat,b.v);
    for(const o of ONC.list)if(o.obj.visible)pass(o,o.d,o.lat,-o.v);
    for(const q of NET.peers.values())if(q.obj)pass(q,q.disp,q.lat,q.v||0);}
  if(L.drive){set(L.drive.g.gain,ped?0.18*sat(v/2.5)*(0.7+0.3*sat(v/12)):0,0.2);set(L.drive.s.playbackRate,clamp((S.cadence>20?S.cadence:85)/88,0.65,1.35),0.3);}
  if(L.free){const on=live&&!ped&&v>1.2;set(L.free.g.gain,on?0.1*sat((v-1.2)/5):0,on?0.35:0.12);set(L.free.s.playbackRate,clamp(v/11,0.45,1.3),0.3);}
  const ws=sat((v-2)/16);set(L.wind.g.gain,0.5*ws*ws,0.4);set(L.wind.f.frequency,350+v*45,0.4);
  let water=0,city=0;
  if(live){const p=player.position;
    if(IS_ULM){water=sat(1-(riverDist(p.x,p.z).d-RIVER_HW)/150)*0.5;city=sat(ulmZone(p.x,p.z).d)*0.12;}
    else{let w=0;for(let k=0;k<8;k++){const a=k*Math.PI/4;for(const r of [150,300])if(rawHeight(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r)<0)w+=r<200?1:0.5;}water=sat(w/3)*0.6;}}
  set(L.water.g.gain,water*(IS_ULM?1:0.6+0.4*Math.sin(t*0.9)*Math.sin(t*0.37)),0.8);set(L.city.g.gain,city,1.0);
  if(live&&t>SND.nextBird){SND.nextBird=t+rnd(4,11);if(city<0.2&&Math.random()<0.8)sndBirds();}}

/* ================= Comic-Look: Toon-Materialien, Konturen, Wolken & Details ================= */
let TOON_GRAD=null;
function toonGrad(){if(TOON_GRAD)return TOON_GRAD;
  const d=new Uint8Array([105,105,105,255,175,175,175,255,228,228,228,255,255,255,255,255]);
  TOON_GRAD=new THREE.DataTexture(d,4,1,THREE.RGBAFormat);TOON_GRAD.minFilter=TOON_GRAD.magFilter=THREE.NearestFilter;TOON_GRAD.generateMipmaps=false;TOON_GRAD.needsUpdate=true;return TOON_GRAD;}
function toonMat(m,cache){
  if(!m||!(m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial))return m;
  if(cache.has(m))return cache.get(m);
  const t=new THREE.MeshToonMaterial({color:m.color,map:m.map||null,gradientMap:toonGrad(),vertexColors:m.vertexColors,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,
    emissive:m.emissive||new THREE.Color(0),emissiveIntensity:m.emissiveIntensity!==undefined?m.emissiveIntensity:1,depthWrite:m.depthWrite,fog:m.fog});
  t.polygonOffset=m.polygonOffset;t.polygonOffsetFactor=m.polygonOffsetFactor;t.polygonOffsetUnits=m.polygonOffsetUnits;
  if(m.flatShading)t.flatShading=true;if(m.skinning)t.skinning=true;if(m.userData.det){t.onBeforeCompile=m.onBeforeCompile;t.customProgramCacheKey=m.customProgramCacheKey;}t.userData=m.userData;cache.set(m,t);return t;}
function toonify(root){const cache=new Map();
  root.traverse(o=>{if(!o.isMesh||o.material&&o.material.isShaderMaterial)return;
    o.material=Array.isArray(o.material)?o.material.map(m=>toonMat(m,cache)):toonMat(o.material,cache);});}
// Konturen: Kanten aus dem Tiefenpuffer (Laplace von 1/z) + FXAA
let POST=null;
function initPost(){
  const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  const dt=new THREE.DepthTexture(size.x,size.y);dt.type=THREE.UnsignedIntType;
  const rtA=new THREE.WebGLRenderTarget(size.x,size.y,{depthTexture:dt,depthBuffer:true,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const rtB=new THREE.WebGLRenderTarget(size.x,size.y,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
  const vs='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const edge=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
    uniforms:{tCol:{value:rtA.texture},tDep:{value:dt},px:{value:new THREE.Vector2(1/size.x,1/size.y)},near:{value:camera.near},far:{value:camera.far},ink:{value:new THREE.Color(0x1e0f3a)},thick:{value:1},spd:{value:0},tm:{value:0},asp:{value:1}},
    vertexShader:vs,fragmentShader:`#include <packing>
      uniform sampler2D tCol,tDep;uniform vec2 px;uniform float near,far,thick,spd,tm,asp;uniform vec3 ink;varying vec2 vUv;
      float Z(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDep,uv).x,near,far);}
      float h1(float n){return fract(sin(n*12.9898)*43758.5453);}
      // Comic-Speed-Linien: helle Striche zum Bildrand hin, die 14-mal pro Sekunde neu ausgewürfelt werden
      vec3 speedLines(vec3 col){if(spd<0.01)return col;vec2 q=vUv-0.5;q.x*=asp;float r=length(q),a=atan(q.y,q.x)/6.2832*120.0;
        float b=floor(a),f=fract(a),k=floor(tm*14.0),n=h1(b+k*37.1);if(n<1.0-0.5*spd)return col;
        float w=0.12+0.2*h1(b*3.7+k),l=(1.0-smoothstep(w*0.5,w*0.5+0.06,abs(f-0.5)))*smoothstep(0.30+0.2*h1(b*7.3+k*1.7),0.46+0.2*h1(b*7.3+k*1.7),r);
        return mix(col,vec3(1.0),l*0.55*spd);}
      void main(){vec4 c=texture2D(tCol,vUv);float z=Z(vUv);
        if(z>far*0.7){gl_FragColor=vec4(speedLines(c.rgb),1.0);return;}
        vec2 o=px*thick;float wc=1.0/z;
        float wl=1.0/Z(vUv-vec2(o.x,0.0)),wr=1.0/Z(vUv+vec2(o.x,0.0)),wu=1.0/Z(vUv+vec2(0.0,o.y)),wd=1.0/Z(vUv-vec2(0.0,o.y));
        float wl2=1.0/Z(vUv+o*vec2(-1.0,1.0)),wr2=1.0/Z(vUv+o),wu2=1.0/Z(vUv-o),wd2=1.0/Z(vUv+o*vec2(1.0,-1.0));
        float lap=(wl+wr+wu+wd-4.0*wc)/wc,lap2=(wl2+wr2+wu2+wd2-4.0*wc)/wc;
        // nur die vordere Seite einer Kante einfärben (Nachbarn weiter weg -> Laplace negativ)
        float sil=smoothstep(0.035,0.11,-min(lap,lap2*0.5));
        float crease=smoothstep(0.012,0.04,abs(lap))*smoothstep(0.012,0.04,abs(lap2)*0.5)*0.55;
        float e=max(sil,crease)*(1.0-smoothstep(500.0,2600.0,z));
        gl_FragColor=vec4(speedLines(mix(c.rgb,ink,e*0.92)),1.0);}`});
  const fxaa=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tDiffuse:{value:rtB.texture},px:{value:new THREE.Vector2(1/size.x,1/size.y)}},vertexShader:vs,
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 px;varying vec2 vUv;
      void main(){vec3 nw=texture2D(tDiffuse,vUv+vec2(-1.0,-1.0)*px).rgb,ne=texture2D(tDiffuse,vUv+vec2(1.0,-1.0)*px).rgb,sw=texture2D(tDiffuse,vUv+vec2(-1.0,1.0)*px).rgb,se=texture2D(tDiffuse,vUv+vec2(1.0,1.0)*px).rgb,m=texture2D(tDiffuse,vUv).rgb;
        vec3 L=vec3(0.299,0.587,0.114);float lnw=dot(nw,L),lne=dot(ne,L),lsw=dot(sw,L),lse=dot(se,L),lm=dot(m,L);
        float lmin=min(lm,min(min(lnw,lne),min(lsw,lse))),lmax=max(lm,max(max(lnw,lne),max(lsw,lse)));
        vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
        float red=max((lnw+lne+lsw+lse)*0.03125,1.0/128.0),rcp=1.0/(min(abs(dir.x),abs(dir.y))+red);
        dir=clamp(dir*rcp,vec2(-8.0),vec2(8.0))*px;
        vec3 a=0.5*(texture2D(tDiffuse,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tDiffuse,vUv+dir*(2.0/3.0-0.5)).rgb);
        vec3 b=a*0.5+0.25*(texture2D(tDiffuse,vUv-dir*0.5).rgb+texture2D(tDiffuse,vUv+dir*0.5).rgb);
        float lb=dot(b,L);gl_FragColor=vec4((lb<lmin||lb>lmax)?a:b,1.0);}`});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),edge);quad.frustumCulled=false;const qs=new THREE.Scene();qs.add(quad);
  POST={rtA,rtB,dt,edge,fxaa,quad,qs,cam:new THREE.OrthographicCamera(-1,1,1,-1,0,1)};
  addEventListener('resize',resizePost);}
function resizePost(){if(!POST)return;const s=renderer.getDrawingBufferSize(new THREE.Vector2());
  POST.rtA.setSize(s.x,s.y);POST.rtB.setSize(s.x,s.y);POST.edge.uniforms.px.value.set(1/s.x,1/s.y);POST.fxaa.uniforms.px.value.set(1/s.x,1/s.y);
  POST.edge.uniforms.thick.value=Math.max(1.4,renderer.getPixelRatio()*1.1);}
function renderFrame(){
  if(!S.toon){renderer.render(scene,camera);return;}
  if(!POST){initPost();resizePost();}
  const s=renderer.getDrawingBufferSize(new THREE.Vector2());if(POST.rtA.width!==s.x||POST.rtA.height!==s.y)resizePost();
  POST.edge.uniforms.near.value=camera.near;POST.edge.uniforms.far.value=camera.far;
  {const u=POST.edge.uniforms,tg=S.started&&!S.paused?sat((S.v*3.6-32)/28):0;u.spd.value+=(tg-u.spd.value)*0.05;u.tm.value=performance.now()/1000;u.asp.value=s.x/s.y;}
  renderer.setRenderTarget(POST.rtA);renderer.render(scene,camera);
  const fx=S.quality!=='low';POST.quad.material=POST.edge;renderer.setRenderTarget(fx?POST.rtB:null);renderer.render(POST.qs,POST.cam);
  if(fx){POST.quad.material=POST.fxaa;renderer.setRenderTarget(null);renderer.render(POST.qs,POST.cam);}}
// Comic-Wolken aus Kugeln
function toonClouds(n,y0,y1){
  const base=new THREE.IcosahedronGeometry(1,2),mat=new THREE.MeshToonMaterial({color:0xffffff,gradientMap:toonGrad(),fog:false,emissive:0x8aa6c8,emissiveIntensity:0.35});
  for(let k=0;k<n;k++){const parts=[],m=4+Math.floor(Math.random()*4),w=rnd(160,320);
    for(let q=0;q<m;q++){const g=base.clone(),r=rnd(0.45,0.8)*w*(q===0||q===m-1?0.7:1);g.scale(r,r*0.82,r*0.9);g.translate((q-(m-1)/2)*w*0.62+rnd(-20,20),rnd(-10,w*0.15)+(q%2)*w*0.12,rnd(-30,30));parts.push(g);}
    const bot=base.clone();bot.scale(w*m*0.34,w*0.18,w*0.5);bot.translate(0,-w*0.25,0);parts.push(bot);
    const g=mergeGeos(parts),c=new THREE.Mesh(g,mat);c.position.set(rnd(-9000,9000),rnd(y0,y1),rnd(-9000,9000));c.rotation.y=rnd(0,6.28);scene.add(c);clouds.push(c);}}
function mergeGeos(list){let n=0;for(const g of list){const gg=g.index?g.toNonIndexed():g;g.__n=gg;n+=gg.attributes.position.count;}
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;
  for(const g of list){const gg=g.__n;gg.computeVertexNormals();pos.set(gg.attributes.position.array,o*3);nor.set(gg.attributes.normal.array,o*3);o+=gg.attributes.position.count;}
  const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.BufferAttribute(pos,3));r.setAttribute('normal',new THREE.BufferAttribute(nor,3));return r;}
// Wimpelkette quer über die Straße
function bunting(d,colors){for(let k=0;k<30;k++){const a=roadAt(d-10),b=roadAt(d+10);if(a.tx*b.tx+a.tz*b.tz>0.985)break;d+=6;}const r=roadAt(d),rx=-r.tz,rz=r.tx,g=new THREE.Group(),H=5.6,span=7.2;
  const pole=new THREE.CylinderGeometry(0.09,0.11,H,6);pole.translate(0,H/2,0);const pm=std(0xf4f1ea,0.7);
  for(const s of [-1,1]){const p=new THREE.Mesh(pole,pm);p.position.set(rx*s*span,0,rz*s*span);g.add(p);}
  const cols=colors||[0xe8463c,0xffd23f,0x3ec1d3,0x7ad35a,0xff7a1a,0xb06fe0,0xffffff];const tri=new THREE.BufferGeometry();
  tri.setAttribute('position',new THREE.Float32BufferAttribute([-0.32,0,0,0.32,0,0,0,-0.75,0],3));tri.computeVertexNormals();
  const n=22;for(let k=0;k<n;k++){const t=k/(n-1),x=-span+2*span*t,sag=Math.pow(2*t-1,2)*1.1-1.1;
    const f=new THREE.Mesh(tri,std(cols[k%cols.length],0.7,0,{side:THREE.DoubleSide}));f.position.set(rx*x,H+sag-0.05,rz*x);f.rotation.y=Math.atan2(r.tx,r.tz)+Math.PI/2;g.add(f);}
  const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-1,-0.5,0,0.5,1].map(t=>new THREE.Vector3(rx*span*t,H+(t*t)*1.1-1.1+0.02,rz*span*t))),16,0.03,4),std(0x333333));g.add(line);
  g.position.set(r.x,r.h+0.2,r.z);scene.add(g);}
// Blumen am Straßenrand
function flowers(count,ok){const stem=new THREE.CylinderGeometry(0.02,0.02,0.45,4);stem.translate(0,0.22,0);
  const head=new THREE.IcosahedronGeometry(0.13,0);head.translate(0,0.5,0);
  const sm=new THREE.InstancedMesh(stem,std(0x3f8f3a),count),hm=new THREE.InstancedMesh(head,std(0xffffff,0.8,0,{flatShading:true}),count);
  const dm=new THREE.Object3D(),col=new THREE.Color(),cols=[0xe8463c,0xffd23f,0xffffff,0xb06fe0,0xff8fb8,0x3e8fe0];let k=0,tries=0;
  while(k<count&&tries<count*20){tries++;const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(6.5,18),[x,z]=lateralPoint(i,off);if(!ok(x,z)||nearestRoad(x,z,7.2))continue; // in Haarnadelkurven nicht auf dem anderen Ast
    const cl=cols[Math.floor(Math.random()*cols.length)];for(let q=0;q<5&&k<count;q++){const fx=x+rnd(-1.4,1.4),fz=z+rnd(-1.4,1.4);
      dm.position.set(fx,groundH(fx,fz)-0.04,fz);const s=rnd(0.8,1.5);dm.scale.set(s,s,s);dm.rotation.set(0,rnd(0,6),0);dm.updateMatrix();sm.setMatrixAt(k,dm.matrix);hm.setMatrixAt(k,dm.matrix);col.set(cl);hm.setColorAt(k,col);k++;}}
  sm.count=hm.count=k;sm.frustumCulled=hm.frustumCulled=false;scene.add(sm,hm);}
// Heißluftballons
let BALLOONS=[];
function balloons(n,cx,cz,R,y0){const stripes=[[0xe8463c,0xffd23f],[0x3ec1d3,0xffffff],[0x7ad35a,0xff7a1a],[0xb06fe0,0xffd23f],[0xff8fb8,0x3e8fe0]];
  for(let k=0;k<n;k++){const g=new THREE.Group(),[a,b]=stripes[k%stripes.length];
    for(let q=0;q<8;q++){const s=new THREE.Mesh(new THREE.SphereGeometry(9,6,10,q*Math.PI/4,Math.PI/4),std(q%2?a:b,0.7,0,{flatShading:true}));s.scale.y=1.18;g.add(s);}
    const cone=new THREE.Mesh(new THREE.CylinderGeometry(5.6,1.6,6,8,1,true),std(a,0.7,0,{side:THREE.DoubleSide}));cone.position.y=-11.5;g.add(cone);
    const bask=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.6,2.2),std(0x8a5a32));bask.position.y=-17.5;g.add(bask);
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3.4,3),std(0x333333));rope.position.set(x*1.2,-15.6,z*1.2);g.add(rope);}
    const ang=rnd(0,6.28),rr=rnd(R*0.2,R);g.position.set(cx+Math.cos(ang)*rr,y0+rnd(0,160),cz+Math.sin(ang)*rr);g.userData={seed:rnd(0,10),vx:rnd(0.6,1.4),vz:rnd(-0.4,0.4)};
    g.traverse(o=>{if(o.isMesh)o.castShadow=false;});scene.add(g);BALLOONS.push(g);}}
// Vogelschwärme
let BIRDS=[];
function birds(n,o={}){const wing=new THREE.BufferGeometry();wing.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-1.4,0.5,-0.35,-1.4,0,0.35, 0,0,0,1.4,0,0.35,1.4,0.5,-0.35],3));wing.computeVertexNormals();
  const m=new THREE.MeshBasicMaterial({color:o.col||0x1e0f3a,side:THREE.DoubleSide}),C=o.cnt||[5,9],Y=o.y||[140,260],R=o.r||[600,1400],SP=o.sp||[0.02,0.04],out=[];
  for(let f=0;f<n;f++){const flock=new THREE.Group(),cnt=C[0]+Math.floor(Math.random()*(C[1]-C[0]+1));
    for(let k=0;k<cnt;k++){const b=new THREE.Mesh(wing,m);const row=Math.ceil(k/2),side=k%2?1:-1;b.position.set(side*row*3,rnd(-0.5,0.5),row*3.5);b.userData.ph=rnd(0,6);flock.add(b);}
    if(o.s)flock.scale.setScalar(o.s);const c=o.center?o.center():[rnd(-600,600),rnd(-600,600)];
    flock.position.set(c[0],rnd(Y[0],Y[1]),c[1]);flock.userData={ang:rnd(0,6.28),r:rnd(R[0],R[1]),sp:rnd(SP[0],SP[1]),cy:flock.position.y,cx:c[0],cz:c[1]};scene.add(flock);BIRDS.push(flock);out.push(flock);}
  return out;}
// Schafe auf Wiesen
function sheep(count,ok){const body=new THREE.IcosahedronGeometry(0.75,1);body.scale(1.25,0.9,0.95);body.translate(0,0.95,0);
  const head=new THREE.BoxGeometry(0.42,0.46,0.5);head.translate(1.0,1.15,0);const leg=new THREE.CylinderGeometry(0.07,0.07,0.6,4);
  const legs=[[0.5,0.3,0.32],[0.5,0.3,-0.32],[-0.5,0.3,0.32],[-0.5,0.3,-0.32]].map(p=>{const g=leg.clone();g.translate(...p);return g;});
  const bm=new THREE.InstancedMesh(body,std(0xf7f4ec,0.9,0,{flatShading:true}),count),hm=new THREE.InstancedMesh(mergeGeos([head,...legs]),std(0x2a2630,0.8),count);
  const dm=new THREE.Object3D();let k=0,tries=0;
  while(k<count&&tries<count*40){tries++;const i=Math.random()*N|0,off=(Math.random()<0.5?-1:1)*rnd(22,70),[x,z]=lateralPoint(i,off);if(!ok(x,z))continue;
    for(let q=0;q<4&&k<count;q++){const sx=x+rnd(-8,8),sz=z+rnd(-8,8);if(nearestRoad(sx,sz,9))continue;dm.position.set(sx,groundH(sx,sz)-0.05,sz);dm.rotation.set(0,rnd(0,6.28),0);const s=rnd(0.9,1.15);dm.scale.set(s,s,s);dm.updateMatrix();bm.setMatrixAt(k,dm.matrix);hm.setMatrixAt(k,dm.matrix);k++;}}
  bm.count=hm.count=k;bm.castShadow=hm.castShadow=true;bm.frustumCulled=hm.frustumCulled=false;scene.add(bm,hm);}
function animExtras(dt,t){
  if(S.started&&player){const dm=animExtras.dm||(animExtras.dm=new THREE.Object3D());
    for(const f of FANS){if(Math.hypot(f.cx-player.position.x,f.cz-player.position.z)>260)continue;
      f.base.forEach((b,k)=>{dm.position.set(b.x,b.y+Math.max(0,Math.sin(t*b.sp+b.ph))*0.28,b.z);dm.rotation.set(0,b.ry+Math.sin(t*2+b.ph)*0.15,0);dm.scale.setScalar(b.s);dm.updateMatrix();for(const m of f.ms)m.setMatrixAt(k,dm.matrix);});
      for(const m of f.ms)m.instanceMatrix.needsUpdate=true;}}
  for(const b of BALLOONS){const u=b.userData;b.position.x+=u.vx*dt;b.position.z+=u.vz*dt;b.position.y+=Math.sin(t*0.2+u.seed)*0.05;b.rotation.y+=dt*0.02;if(b.position.x>5000)b.position.x=-5000;}
  for(const f of BIRDS){const u=f.userData;u.ang+=u.sp*dt;f.position.set(u.cx+Math.cos(u.ang)*u.r,u.cy+Math.sin(u.ang*3)*10,u.cz+Math.sin(u.ang)*u.r);f.rotation.y=-u.ang;
    for(const b of f.children){const s=Math.sin(t*9+b.userData.ph);b.scale.y=0.4+0.9*Math.abs(s);b.rotation.z=s*0.15;}}}

/* ================= Karte (Minikarte im HUD + große Karte im Menü) ================= */
const MAP={bg:null,x0:0,z0:0,mpp:1,mode:'follow',labels:[],rot:0};
function mapLabel(t,x,z,kind){MAP.labels.push({t,x,z,kind:kind||'lm'});}
function buildMapBg(){
  let x0,x1,z0,z1;
  if(IS_ULM){const A=ULM.area;x0=A.x0+2300;x1=A.x1-2300;z0=A.z0+2300;z1=A.z1-2300;}
  else{x0=-3400;x1=3400;z0=-3400;z1=3400;}
  const W=S.quality==='low'?1300:2000,mpp=(x1-x0)/W,H=Math.round((z1-z0)/mpp);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  MAP.bg=c;MAP.x0=x0;MAP.z0=z0;MAP.mpp=mpp;
  const P=(wx,wz)=>[(wx-x0)/mpp,(wz-z0)/mpp];
  // Untergrund: Höhen-/Flächenfarben aus einem groben Raster
  const st=IS_ULM?40:30,img=x.createImageData(Math.ceil(W*mpp/st),Math.ceil(H*mpp/st));
  for(let j=0;j<img.height;j++)for(let i=0;i<img.width;i++){const wx=x0+i*st,wz=z0+j*st,o=(j*img.width+i)*4;let r,g,b;
    if(IS_ULM){const h=ulmDem(wx,wz),zn=ulmZone(wx,wz),t=clamp((h-470)/150,0,1);
      r=196-50*t;g=226-35*t;b=160-40*t;           // Wiese, höher = dunkler
      if(slopeY(wx,wz)<0.93){r=150;g=196;b=120;}   // Hänge/Wald
      const u=zn.d;if(u>0.05){const cr=[238,232,220];r+=(cr[0]-r)*Math.min(1,u*1.1);g+=(cr[1]-g)*Math.min(1,u*1.1);b+=(cr[2]-b)*Math.min(1,u*1.1);}}
    else{const h=rawHeight(wx,wz),dv=Math.hypot(wx-VOLC.x,wz-VOLC.z);
      if(h<0){const d=clamp(-h/40,0,1);r=120-60*d;g=200-50*d;b=230-20*d;}
      else if(h<2.5){r=245;g=226;b=170;}
      else{const t=clamp(h/300,0,1);r=150+40*t;g=205-60*t;b=110-20*t;if(dv<VOLC.r*0.55){r=196+20*t;g=150-10*t;b=110-20*t;}if(dv<160){r=255;g=110;b=40;}}}
    img.data[o]=r;img.data[o+1]=g;img.data[o+2]=b;img.data[o+3]=255;}
  const tmp=document.createElement('canvas');tmp.width=img.width;tmp.height=img.height;tmp.getContext('2d').putImageData(img,0,0);
  x.imageSmoothingEnabled=true;x.drawImage(tmp,0,0,W,H);
  const line=(pts,w,col,close)=>{x.beginPath();pts.forEach((p,k)=>{const q=P(p[0],p[1]);k?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]);});if(close)x.closePath();x.lineWidth=w;x.strokeStyle=col;x.lineJoin=x.lineCap='round';x.stroke();};
  if(IS_ULM){for(const rv of ULM.rivers){const w=(rv.p.reduce((a,q)=>a+q[2]+q[3],0)/rv.p.length);line(rv.p,Math.max(1.5,w/mpp),'#6cc3e8');line(rv.p,Math.max(1,w*0.7/mpp),'#86d3f2');}
    for(const rd of ULM.vroads||[]){line(rd.p,Math.max(2,rd.w*2/mpp)+2,'#9a948a');}
    for(const rd of ULM.vroads||[]){line(rd.p,Math.max(1.5,rd.w*2/mpp),'#ffffff');}}
  // Häuser als Grundrisse
  if(IS_ULM){x.fillStyle='#cbbfae';for(const P2 of MAPPOLY){x.beginPath();P2.forEach((q,k)=>{const a=P(q[0],q[1]);k?x.lineTo(a[0],a[1]):x.moveTo(a[0],a[1]);});x.closePath();x.fill();}
    for(const [bx,bz,bw,bd,ry,alt] of MAPBLD){const q=P(bx,bz);x.save();x.translate(q[0],q[1]);x.rotate(-ry);x.fillStyle=alt?'#d9a98f':'#cbbfae';x.fillRect(-bw/2/mpp,-bd/2/mpp,bw/mpp,bd/mpp);x.restore();}}
  // Wegpunkte der Strecke für das Vektor-Zeichnen
  MAP.route=[];for(let i=0;i<N;i+=3)MAP.route.push([RX[i],RZ[i]]);MAP.route.push([RX[0],RZ[0]]);
  MAP.climbs=CLIMBS.map(cl=>{const pts=[];for(let d=cl.start;d<=cl.end;d+=ds*3){const r=roadAt(d);pts.push([r.x,r.z]);}return pts;});
}
function drawMap(c,opts){
  if(!MAP.bg)return;const dpr=Math.min(devicePixelRatio,2),w=c.clientWidth,h=c.clientHeight;if(!w)return;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  const me=player?player.position:{x:RX[0],z:RZ[0]};let cx,cz,span,rot=0;
  if(opts.mode==='follow'){cx=me.x;cz=me.z;span=opts.span||1400;const r=roadAt(S.dist);rot=-Math.atan2(r.tx,-r.tz);MAP.rot+=((((rot-MAP.rot)%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI)*0.15;MAP.rot=Math.atan2(Math.sin(MAP.rot),Math.cos(MAP.rot));rot=MAP.rot;}
  else{let a=1e9,b=-1e9,c2=1e9,d=-1e9;for(let i=0;i<N;i+=8){a=Math.min(a,RX[i]);b=Math.max(b,RX[i]);c2=Math.min(c2,RZ[i]);d=Math.max(d,RZ[i]);}
    cx=(a+b)/2;cz=(c2+d)/2;span=Math.max(b-a,(d-c2)*w/h)*1.12;}
  const sc=w/span; // px pro m
  x.save();x.translate(w/2,h/2);x.rotate(rot);x.scale(sc,sc);x.translate(-cx,-cz);
  x.fillStyle=IS_ULM?'#c4e2a0':'#78c8e6';x.fillRect(cx-span*2,cz-span*2,span*4,span*4);
  x.imageSmoothingEnabled=true;x.drawImage(MAP.bg,MAP.x0,MAP.z0,MAP.bg.width*MAP.mpp,MAP.bg.height*MAP.mpp);
  const px1=1/sc,pl=(pts,wpx,col,close)=>{x.beginPath();pts.forEach((p,k)=>k?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));if(close)x.closePath();x.lineWidth=wpx*px1;x.strokeStyle=col;x.lineJoin=x.lineCap='round';x.stroke();};
  if(IS_ULM&&ULM.vroads){const lim=span*0.9;for(const rd of ULM.vroads){const q=rd.p[0],q2=rd.p[rd.p.length-1];if(opts.mode==='follow'&&Math.hypot(q[0]-cx,q[1]-cz)>lim+3000&&Math.hypot(q2[0]-cx,q2[1]-cz)>lim+3000)continue;pl(rd.p,Math.max(2.5,rd.w*2*sc)+1.5,'#a59d90');}
    for(const rd of ULM.vroads){pl(rd.p,Math.max(1.6,rd.w*2*sc),'#ffffff');}}
  const rw=opts.big?4.5:opts.mode==='follow'?Math.max(4,9*sc):3.6;
  pl(MAP.route,rw+3,'#1e0f3a');pl(MAP.route,rw,'#eb567b');for(const c of MAP.climbs)pl(c,rw,'#e8463c');
  {const q=[RX[0],RZ[0]],r0=8*px1;x.fillStyle='#fff';x.strokeStyle='#1e0f3a';x.lineWidth=2.5*px1;x.beginPath();x.arc(q[0],q[1],r0,0,7);x.fill();x.stroke();
    x.fillStyle='#1e0f3a';const u=r0*0.6;for(let a=0;a<2;a++)for(let b=0;b<2;b++)if((a+b)%2===0)x.fillRect(q[0]-u+a*u,q[1]-u+b*u,u,u);}
  x.restore();
  const T2=(wx,wz)=>{const dx=(wx-cx)*sc,dz=(wz-cz)*sc;return [w/2+dx*Math.cos(rot)-dz*Math.sin(rot),h/2+dx*Math.sin(rot)+dz*Math.cos(rot)];};
  // Wahrzeichen
  x.font=`600 ${opts.big?12:10}px Fredoka,system-ui,sans-serif`;x.textAlign='center';x.textBaseline='bottom';
  const boxes=[],order=MAP.labels.slice().sort((a,b)=>(b.kind==='key')-(a.kind==='key'));
  for(const lb of order){const [px,py]=T2(lb.x,lb.z);if(px<-40||py<-20||px>w+40||py>h+20)continue;
    if(!opts.big&&opts.mode!=='follow'&&lb.kind!=='key')continue;
    const tw=x.measureText(lb.t).width,bx=[px-tw/2-3,py-20,px+tw/2+3,py+5];if(boxes.some(b=>bx[0]<b[2]&&bx[2]>b[0]&&bx[1]<b[3]&&bx[3]>b[1]))continue;boxes.push(bx);
    x.fillStyle=lb.kind==='key'?'#f8d74e':'#fff';x.strokeStyle='#1e0f3a';x.lineWidth=2;x.beginPath();x.arc(px,py,4,0,7);x.fill();x.stroke();
    x.lineWidth=3;x.strokeStyle='rgba(255,250,240,.95)';x.strokeText(lb.t,px,py-5);x.fillStyle='#1e0f3a';x.fillText(lb.t,px,py-5);}
  // andere Fahrer
  const dot=(o,col,r)=>{const [px,py]=T2(o.x,o.z);x.fillStyle=col;x.strokeStyle='#1e0f3a';x.lineWidth=1.5;x.beginPath();x.arc(px,py,r,0,7);x.fill();x.stroke();};
  for(const b of BOTS)if(b.active)dot(b.obj.position,'#'+b.color.toString(16).padStart(6,'0'),3.5);
  if(typeof NET!=='undefined')for(const r of NET.peers.values())if(r.obj)dot(r.obj.position,'#'+(r.col||0x490cb8).toString(16).padStart(6,'0'),5);
  // ich: Pfeil in Fahrtrichtung
  {const r=roadAt(S.dist),[px,py]=T2(me.x,me.z),ang=Math.atan2(r.tz,r.tx)+rot;
    x.save();x.translate(px,py);x.rotate(ang);x.fillStyle='#eb567b';x.strokeStyle='#1e0f3a';x.lineWidth=2;x.beginPath();x.moveTo(9,0);x.lineTo(-6,-6);x.lineTo(-3,0);x.lineTo(-6,6);x.closePath();x.fill();x.stroke();x.restore();}
  // Nordpfeil
  {x.save();x.translate(w-16,16);x.rotate(rot);x.fillStyle='#fffaf0';x.strokeStyle='#1e0f3a';x.lineWidth=1.5;x.beginPath();x.arc(0,0,11,0,7);x.fill();x.stroke();
    x.fillStyle='#e8463c';x.beginPath();x.moveTo(0,-9);x.lineTo(4,0);x.lineTo(-4,0);x.closePath();x.fill();x.fillStyle='#1e0f3a';x.font='700 8px Fredoka,system-ui';x.textBaseline='middle';x.fillText('N',0,4);x.restore();}
  if(opts.mode==='follow'){x.fillStyle='rgba(30,15,58,.75)';x.font='600 10px Fredoka,system-ui';x.textAlign='left';x.textBaseline='bottom';
    const m=Math.round(span/4/100)*100||100,bar=m*sc;x.fillRect(8,h-8,bar,3);x.fillText(m+' m',8,h-12);}
}
let mapT=0;
function updateMap(now){if(MAP.mode==='off'||now-mapT<(S.quality==='low'?400:200))return;mapT=now;drawMap($('mapC'),{mode:MAP.mode});}
function cycleMap(){MAP.mode=MAP.mode==='follow'?'route':MAP.mode==='route'?'off':'follow';applyMapMode();try{localStorage.setItem('kalea_map',MAP.mode);}catch(e){}}
function applyMapMode(){document.body.classList.toggle('map-on',MAP.mode!=='off');$('mapBox').classList.toggle('off',MAP.mode==='off');
  $('mapMode').textContent=MAP.mode==='follow'?'Umgebung':MAP.mode==='route'?'Ganze Strecke':'Karte';mapT=0;}

/* ================= Echte Häuser aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL) ================= */
function osmUnpack(R){const b=[];for(const r of R.b){const f=r[0],p=[];let x=f[0],z=f[1];p.push(x/5,z/5);for(let i=2;i<f.length;i+=2){x+=f[i];z+=f[i+1];p.push(x/5,z/5);}
  b.push({p,b:R.t[r[1]]||'yes',h:r[2]||0,l:r[3]||0,rs:R.r[r[4]||0]||'',rc:r[5]||'',bc:r[6]||''});}
  return {b,ts:Date.parse(R.ts)||Date.now(),embedded:true};}
let OSM_EMBED=null;
const OSM={data:null,polys:[],radius:190,core:620};
const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('kaleaRide',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbGet(k){try{const db=await idb();return await new Promise(res=>{const t=db.transaction('kv').objectStore('kv').get(k);t.onsuccess=()=>res(t.result||null);t.onerror=()=>res(null);});}catch(e){return null;}}
async function idbSet(k,v){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});return true;}catch(e){return false;}}
async function idbDel(k){try{const db=await idb();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=res;t.onerror=res;});}catch(e){}}
function osmKey(){return 'osm_ulm_'+ROUTE.id+'_v1';}
function localToLL(x,z){const o=ULM_DATA.origin,kx=111320*Math.cos(o[0]*Math.PI/180);return [o[0]-z/110540,o[1]+x/kx];}
// Streckenlinie stark vereinfachen (Douglas-Peucker), damit die Abfrage kurz bleibt
function simplifyLine(P,tol){if(P.length<3)return P;const a=P[0],b=P[P.length-1];let md=0,mi=0;const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
  for(let i=1;i<P.length-1;i++){const d=Math.abs((P[i][0]-a[0])*dz-(P[i][1]-a[1])*dx)/l;if(d>md){md=d;mi=i;}}
  if(md>tol)return simplifyLine(P.slice(0,mi+1),tol).slice(0,-1).concat(simplifyLine(P.slice(mi),tol));return [a,b];}
function osmQuery(){const P=[];for(let i=0;i<N;i+=3)P.push([RX[i],RZ[i]]);P.push([RX[0],RZ[0]]);
  const h=P.length>>1,SL=simplifyLine(P.slice(0,h+1),12).concat(simplifyLine(P.slice(h),12).slice(1));
  const S2=SL.map(p=>localToLL(p[0],p[1]).map(v=>v.toFixed(5)).join(',')).join(',');
  const m=localToLL(ULM.places.muenster[0],ULM.places.muenster[1]);
  return `[out:json][timeout:120];(way["building"](around:${OSM.radius},${S2});way["building"](around:${OSM.core},${m[0].toFixed(5)},${m[1].toFixed(5)});relation["building"](around:${OSM.radius},${S2}););out geom qt;`;}
function toast(t){const e=$('toast');e.textContent=t;e.classList.remove('hidden');e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),7000);}
// Fortschrittsfenster
function osmUi(o){const el=$('osmProg');el.classList.remove('hidden');
  if(o.title!==undefined)$('opTitle').textContent=o.title;if(o.text!==undefined)$('opText').innerHTML=o.text;
  if(o.pct!==undefined){const b=$('opBar');b.classList.toggle('indet',o.pct<0);b.firstElementChild.style.width=(o.pct<0?100:Math.max(2,Math.min(100,o.pct)))+'%';}
  if(o.state!==undefined)el.dataset.state=o.state;
  [1,2,3,4].forEach(k=>{const st=$('ops'+k);st.className=k<o.step?'done':k===o.step?'act':'';});
  $('opBtns').innerHTML=o.btns||'';}
async function osmDownload(){
  const q=osmQuery(),expect=Math.max(1.5,Math.min(30,L/1000*0.55))*1e6;let lastErr='',blocked=0;const t0=performance.now();
  for(const url of OVERPASS){const host=url.split('/')[2];
    osmUi({title:'Echte Häuser laden',state:'busy',step:1,pct:-1,text:`Frage OpenStreetMap-Server <b>${host}</b> an …<br><small>Der Server sucht alle Häuser entlang der Route heraus. Das dauert meist 10–60 Sekunden.</small>`});
    const tick=setInterval(()=>{const sec=Math.round((performance.now()-t0)/1000);$('opText').querySelector('small').textContent=`Der Server sucht alle Häuser entlang der Route heraus – ${sec} s … (meist 10–60 s)`;},1000);
    try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),150000);
      const r=await fetch(url,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctl.signal});
      clearInterval(tick);
      if(!r.ok){clearTimeout(to);lastErr=r.status===429?'Server ausgelastet (429)':r.status===504?'Server überlastet (504)':'Server antwortet '+r.status;continue;}
      // Herunterladen mit Fortschritt
      const total=+r.headers.get('Content-Length')||0,rd=r.body&&r.body.getReader?r.body.getReader():null,chunks=[];let got=0,txt;
      if(rd){for(;;){const {done,value}=await rd.read();if(done)break;chunks.push(value);got+=value.length;
          osmUi({step:2,pct:total?got/total*100:Math.min(95,got/expect*100),text:`Lade Häuserdaten herunter: <b>${(got/1e6).toFixed(1)} MB</b>${total?' von '+(total/1e6).toFixed(1)+' MB':''}`});}
        const all=new Uint8Array(got);let o=0;for(const c of chunks){all.set(c,o);o+=c.length;}txt=new TextDecoder().decode(all);}
      else txt=await r.text();
      clearTimeout(to);
      osmUi({step:3,pct:100,text:`Verarbeite ${(txt.length/1e6).toFixed(1)} MB …`});await new Promise(r2=>setTimeout(r2,30));
      const slim=osmSlim(JSON.parse(txt));if(!slim.b.length){lastErr='keine Häuser in der Antwort';continue;}
      osmUi({step:4,pct:100,text:`Speichere ${slim.b.length.toLocaleString('de-DE')} Häuser auf diesem Gerät …`});
      const ok=await idbSet(osmKey(),slim);
      const sec=Math.round((performance.now()-t0)/1000);
      osmUi({title:'✔ Fertig!',state:'ok',step:5,pct:100,text:`<b>${slim.b.length.toLocaleString('de-DE')} echte Häuser</b> für „${ROUTE.name}“ geladen (${(txt.length/1e6).toFixed(1)} MB, ${sec} s).<br>`+
        (ok?'Sie sind gespeichert und werden ab jetzt bei jedem Start genutzt – auch ohne Internet.':'<b>Achtung:</b> Speichern hat nicht geklappt (privater Modus?). Die Häuser gelten nur bis zum Neuladen.'),
        btns:'<button id="opBuild" class="primary">Welt jetzt neu bauen</button>'});
      if(!ok)OSM.data=slim;
      $('opBuild').onclick=()=>{$('osmProg').classList.add('hidden');if(ok){$('loading').classList.remove('hidden');$('loading').textContent='Baue Ulm mit '+slim.b.length.toLocaleString('de-DE')+' echten Häusern …';rebuildWorld(WORLD,ROUTE.id,$('loading').textContent);}};
      wireOsm();return;}
    catch(e){clearInterval(tick);if(e.name==='AbortError')lastErr='Zeitüberschreitung';else{lastErr=e.message;if(/Failed to fetch|NetworkError|Load failed|blocked/i.test(e.message))blocked++;}}}
  const hint=blocked===OVERPASS.length?'Keiner der Server war erreichbar. Entweder fehlt die Internetverbindung, oder diese Ansicht darf keine fremden Server abfragen (z. B. die Vorschau im Claude-Chat). Öffne die Datei direkt im Browser bzw. in Bluefy.':
    'Die Server sind gerade ausgelastet. Versuch es in ein paar Minuten noch einmal.';
  osmUi({title:'Laden hat nicht geklappt',state:'bad',step:0,pct:0,text:`${hint}<br><small>Letzte Meldung: ${lastErr||'unbekannt'}</small>`,btns:'<button id="opRetry" class="primary">Nochmal versuchen</button><button id="opClose">Schließen</button>'});
  $('opRetry').onclick=osmDownload;$('opClose').onclick=()=>$('osmProg').classList.add('hidden');}
// nur das Nötige behalten: Grundriss (lokale Meter, 0,1 m genau), Höhe, Etagen, Dachform, Art
function osmSlim(js){const out=[];const add=(geom,t)=>{if(!geom||geom.length<4)return;const pts=[];for(const g of geom){const p=ulmLL(g.lon,g.lat);pts.push(Math.round(p[0]*10)/10,Math.round(p[1]*10)/10);}
    out.push({p:pts,h:parseFloat(t.height)||0,l:parseFloat(t['building:levels'])||0,rs:t['roof:shape']||'',b:t.building||'yes',rc:t['roof:colour']||'',bc:t['building:colour']||'',n:t.name||''});};
  for(const el of js.elements||[]){if(el.type==='way')add(el.geometry,el.tags||{});
    else if(el.type==='relation'&&el.members)for(const m of el.members)if(m.role==='outer'&&m.geometry)add(m.geometry,el.tags||{});}
  return {b:out,ts:Date.now()};}
async function osmLoadCached(){if(!IS_ULM)return;const d=await idbGet(osmKey());if(d&&d.b&&d.b.length){OSM.data=d;return;}
  if(!OSM_EMBED&&typeof OSM_RAW!=='undefined')OSM_EMBED=osmUnpack(OSM_RAW);if(OSM_EMBED&&OSM_EMBED.b.length){OSM.data=OSM_EMBED;OSM.embedded=true;}}
function osmCovered(x,z){if(!OSM.data)return false;if(Math.hypot(x-ULM.places.muenster[0],z-ULM.places.muenster[1])<OSM.core-20)return true;const nr=nearestRoad(x,z,OSM.radius-25);return !!nr;}
// Mindest-Rechteck (für Satteldächer)
function minRect(P){let best=null;const n=P.length;for(let i=0;i<n;i++){const a=P[i],b=P[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<0.5)continue;const ux=dx/l,uz=dz/l;
    let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;for(const p of P){const u=p[0]*ux+p[1]*uz,v=-p[0]*uz+p[1]*ux;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
    const A=(u1-u0)*(v1-v0);if(!best||A<best.A)best={A,ux,uz,u0,u1,v0,v1};}return best;}
function buildOsmBuildings(){
  const d=OSM.data;if(!d)return 0;const rng=mulberry32(99),pick=a=>a[Math.floor(rng()*a.length)];
  const lim=S.quality==='low'?4500:S.quality==='medium'?9000:20000;
  const wallCols=[0xf3e9d2,0xefd9b8,0xe8d0c0,0xf6f0e1,0xd9e2d6,0xf2dcc8,0xe6e0cf,0xf4d9a8,0xd8e4ec,0xf1c9b5,0xe9e4dc,0xd8d2c8],roofCols=[0x9c4a32,0x8a3b2a,0xa65a3c,0x7a4030,0x6e3a2e,0xb0583a];
  const tiles=new Map();const tileOf=(x,z)=>{const k=Math.floor(x/CHUNK)+'|'+Math.floor(z/CHUNK);if(!tiles.has(k))tiles.set(k,{w:{p:[],n:[],u:[],c:[]},r:{p:[],c:[],u:[]},cx:(Math.floor(x/CHUNK)+0.5)*CHUNK,cz:(Math.floor(z/CHUNK)+0.5)*CHUNK});return tiles.get(k);};
  // Häuser nach Nähe zur Strecke sortieren, damit bei Begrenzung die wichtigen bleiben
  const list=d.b.map(b=>{let sx=0,sz=0;const n=b.p.length/2;for(let i=0;i<n;i++){sx+=b.p[i*2];sz+=b.p[i*2+1];}const cx=sx/n,cz=sz/n,nr=nearestRoad(cx,cz,400);return {b,cx,cz,dr:nr?nr.d:400};}).sort((a,b)=>a.dr-b.dr).slice(0,lim);
  const col=new THREE.Color();let cnt=0;
  for(const {b,cx,cz} of list){let P=[];for(let i=0;i<b.p.length;i+=2)P.push([b.p[i],b.p[i+1]]);
    if(P.length>3&&Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<0.3)P.pop();if(P.length<3)continue;
    let A=0;for(let i=0;i<P.length;i++){const a=P[i],c=P[(i+1)%P.length];A+=a[0]*c[1]-c[0]*a[1];}A/=2;if(Math.abs(A)<12)continue;if(A<0)P.reverse();
    if(!footFree(cx,cz,0))continue; // eigene Wahrzeichen-Modelle haben Vorrang
    {const nr=nearestRoad(cx,cz,30);if(nr&&nr.d<6)continue;let onRoad=false;for(const p of P){const q=nearestRoad(p[0],p[1],5);if(q&&q.d<4.6){onRoad=true;break;}}if(onRoad)continue;}
    // Wände dürfen weder die Strecke noch eine Nebenstraße schneiden und nicht im Fluss stehen (Kanten alle 2 m prüfen)
    {let rad=0;for(const p of P)rad=Math.max(rad,Math.hypot(p[0]-cx,p[1]-cz));const wet=riverDist(cx,cz).d<RIVER_HW+rad+4;let bad=false;
      for(let i=0;i<P.length&&!bad;i++){const a=P[i],c=P[(i+1)%P.length],l=Math.hypot(c[0]-a[0],c[1]-a[1]),k=Math.max(1,Math.ceil(l/2));
        for(let q=0;q<k;q++){const x=a[0]+(c[0]-a[0])*q/k,z=a[1]+(c[1]-a[1])*q/k,nr=nearestRoad(x,z,6);
          if(nr&&nr.d<5.1||wet&&riverDist(x,z).d<RIVER_HW-1){bad=true;break;}const vr=nearVRoad(x,z,8);if(vr&&vr.d<(vr.s.w||4)-0.8){bad=true;break;}}}if(bad)continue;}
    const area=Math.abs(A),bt=b.b;let floors=b.l||(bt==='house'||bt==='detached'||bt==='semidetached_house'?2:bt==='garage'||bt==='garages'||bt==='shed'||bt==='carport'||bt==='roof'?1:bt==='industrial'||bt==='warehouse'?2:area<120?2:3+Math.floor(rng()*2));
    let H=b.h||floors*3.2+0.6;if(bt==='church'||bt==='cathedral')H=Math.max(H,16);H=Math.min(H,90);
    let y0=1e9;for(const p of P)y0=Math.min(y0,finalHeight(p[0],p[1]));y0-=0.6;const top=y0+H+0.6;
    const R=minRect(P),short=R?Math.min(R.u1-R.u0,R.v1-R.v0):0;
    let rs=b.rs;if(!rs)rs=(short<16&&area<450&&bt!=='garage'&&bt!=='garages'&&bt!=='industrial'&&bt!=='commercial'&&bt!=='retail')?(rng()<0.75?'gabled':'hipped'):'flat';
    const t=tileOf(cx,cz),wc=b.bc?safeCol(b.bc,pick(wallCols),'wall'):pick(wallCols),rc=b.rc?safeCol(b.rc,pick(roofCols),'roof'):pick(roofCols);
    // Wände: echte Umrisse, UV = Fensterachsen (3,4 m) × Etagen (3,1 m)
    // Sockel (unten ca. 1 m dunkler) und Wand darüber
    col.set(wc);const pc=col.clone().multiplyScalar(0.8).lerp(new THREE.Color(0x8d877d),0.35);let u=0;const W=t.w,yp=Math.min(top-0.5,y0+1.55),V=y=>(y-y0-0.6)/3.1;
    for(let i=0;i<P.length;i++){const a=P[i],c=P[(i+1)%P.length],l=Math.hypot(c[0]-a[0],c[1]-a[1]);if(l<0.05)continue;const nx=(c[1]-a[1])/l,nz=-(c[0]-a[0])/l,u1=u+l/3.4;
      for(const [ya,yb,cc] of [[y0,yp,pc],[yp,top,col]]){const va=V(ya),vb=V(yb);
        const quad=[[a[0],ya,a[1],u,va],[c[0],ya,c[1],u1,va],[c[0],yb,c[1],u1,vb],[a[0],ya,a[1],u,va],[c[0],yb,c[1],u1,vb],[a[0],yb,a[1],u,vb]];
        for(const q of quad){W.p.push(q[0]-t.cx,q[1],q[2]-t.cz);W.n.push(-nx,0,-nz);W.u.push(q[3],q[4]);W.c.push(cc.r,cc.g,cc.b);}}u=u1;}
    // Dach
    col.set(rs==='flat'?0x8f8a84:rc);const Rf=t.r;let plain=rs==='flat'||!R||short>24;
    // Ziegel-Textur: Reihen nach der Höhe, Spalten schräg über x+z; Flachdächer und Giebel einfarbig (fester Punkt der Textur)
    const tri=(a,b2,c)=>{for(const q of [a,b2,c]){Rf.p.push(q[0]-t.cx,q[1],q[2]-t.cz);Rf.c.push(col.r,col.g,col.b);if(plain)Rf.u.push(0.042,0.978);else Rf.u.push((q[0]+q[2])/3.6,q[1]/3.5);}};
    if(rs==='flat'||!R||short>24){const tris=THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p[0],p[1])),[]);for(const [i0,i1,i2] of tris)tri([P[i0][0],top,P[i0][1]],[P[i2][0],top,P[i2][1]],[P[i1][0],top,P[i1][1]]);}
    else{// Sattel- oder Walmdach über dem Mindest-Rechteck, First entlang der langen Seite
      const {ux,uz,u0,u1:uu1,v0,v1}=R,lu=uu1-u0,lv=v1-v0,alongU=lu>=lv,o=0.5;
      const P2=(u2,v2)=>[u2*ux-v2*uz,u2*uz+v2*ux];const rh=Math.min(9,short*0.45);
      let c0,c1,c2,c3,r0,r1;
      if(alongU){const vm=(v0+v1)/2,hip=rs==='hipped'?lv*0.45:0;c0=P2(u0-o,v0-o);c1=P2(uu1+o,v0-o);c2=P2(uu1+o,v1+o);c3=P2(u0-o,v1+o);r0=P2(u0+hip,vm);r1=P2(uu1-hip,vm);}
      else{const um=(u0+uu1)/2,hip=rs==='hipped'?lu*0.45:0;c0=P2(u0-o,v1+o);c1=P2(u0-o,v0-o);c2=P2(uu1+o,v0-o);c3=P2(uu1+o,v1+o);r0=P2(um,v1-hip);r1=P2(um,v0+hip);}
      const T=(p)=>[p[0],top,p[1]],Rr=(p)=>[p[0],top+rh,p[1]];
      tri(T(c0),Rr(r0),T(c1));tri(T(c1),Rr(r0),Rr(r1));tri(T(c2),T(c3),Rr(r1));tri(T(c3),Rr(r0),Rr(r1));tri(T(c3),T(c0),Rr(r0));tri(T(c1),Rr(r1),T(c2));
      // Giebeldreiecke aus Wandfarbe
      if(rs!=='hipped'){col.set(wc);plain=true;tri(T(c3),T(c0),Rr(r0));tri(T(c1),T(c2),Rr(r1));col.set(rc);}}
    MAPPOLY.push(P);camOccAdd(P,top);cnt++;}
  const wallMat=new THREE.MeshStandardMaterial({map:winTile(),vertexColors:true,roughness:0.9,side:THREE.DoubleSide}),roofMat=new THREE.MeshStandardMaterial({map:roofTileTex(),vertexColors:true,roughness:0.85,flatShading:true,side:THREE.DoubleSide});
  for(const t of tiles.values()){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(t.w.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(t.w.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(t.w.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(t.w.c,3));
    const m=new THREE.Mesh(g,wallMat);m.position.set(t.cx,0,t.cz);m.castShadow=m.receiveShadow=true;scene.add(m);CULLS.push(m);
    if(t.r.p.length){const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(t.r.p,3));g2.setAttribute('color',new THREE.Float32BufferAttribute(t.r.c,3));g2.setAttribute('uv',new THREE.Float32BufferAttribute(t.r.u,2));g2.computeVertexNormals();
      const m2=new THREE.Mesh(g2,roofMat);m2.position.set(t.cx,0,t.cz);m2.castShadow=m2.receiveShadow=true;scene.add(m2);CULLS.push(m2);}}
  console.log('OSM-Häuser',cnt);return cnt;}
const MAPPOLY=[];
// OSM-Farbangaben ("red", "black", …) in natürliche Töne übersetzen
function safeCol(s,fb,kind){try{const c=new THREE.Color(),h={};c.set(s.trim().toLowerCase());c.getHSL(h);
    if(kind==='roof'){h.s=Math.min(h.s,0.45);h.l=Math.min(0.4,Math.max(0.24,h.l*0.75));}else{h.s=Math.min(h.s,0.3);h.l=Math.max(0.74,Math.min(0.92,h.l));}
    c.setHSL(h.h,h.s,h.l);return c.getHex();}catch(e){return fb;}}
async function osmClear(){await idbDel(osmKey());$('vOsm').textContent='Gelöscht – Welt wird neu gebaut …';rebuildWorld(WORLD,ROUTE.id,'Welt wird neu gebaut …');}
function wireOsm(){if(!IS_ULM){$('osmBox').classList.add('hidden');return;}
  const on=!!OSM.data,n=on?OSM.data.b.length:0;$('osmBox').classList.toggle('on',on);
  $('vOsmBadge').textContent=on?'✔ aktiv':'aus';
  $('vOsm').innerHTML=on?`<b>${n.toLocaleString('de-DE')}</b> echte Häuser ${OSM.embedded?'fest eingebaut':'für diese Route'} (Stand ${new Date(OSM.data.ts).toLocaleDateString('de-DE')})${OSM.built?` · <b>${OSM.built.toLocaleString('de-DE')}</b> davon in der Welt aufgebaut`:''}.`:'Noch nicht geladen – die Häuser entlang der Route sind ausgedacht.';
  $('bOsm').textContent=on?'Aktualisieren':'Echte Häuser laden';$('bOsm').disabled=false;$('bOsm').onclick=osmDownload;$('bOsmDel').classList.toggle('hidden',!on||OSM.embedded);$('bOsmDel').onclick=osmClear;}

/* ================= Kamera & Loop ================= */
const VIEWS=[{back:5.2,up:1.9,look:7,lat:0.8},{back:2.6,up:1.45,look:10,lat:0.95},{back:18,up:9,look:4,lat:0.8},{back:-4,up:1.3,look:-1,lat:2.4}];
function updateCamera(dt){
  if(!S.started){const t=performance.now()/1000*0.035;if(IS_ULM){camera.position.set(Math.cos(t)*1500,420,Math.sin(t)*1500);camera.lookAt(0,60,0);}else{camera.position.set(Math.cos(t)*3300+300,900,Math.sin(t)*3300-200);camera.lookAt(500,120,-300);}return;}
  const r=roadAt(S.dist),V=VIEWS[S.cam],rb=roadAt(S.dist-V.back),la=roadAt(S.dist+V.look);
  const rx=-r.tz,rz=r.tx,lat=V.lat;
  const tp=new THREE.Vector3(rb.x+rx*lat,Math.max(rb.h,r.h)+V.up,rb.z+rz*lat);
  const tl=new THREE.Vector3(la.x+rx*0.8,la.h+1.0,la.z+rz*0.8);
  // Haus zwischen Kamera und Fahrer (enge Kurven in der Altstadt)? Dann näher heran und etwas höher
  if(CAMOCC.size&&V.back>0){const px=r.x+rx*0.8,pz=r.z+rz*0.8,py=r.h+1.4,dx=tp.x-px,dy=tp.y-py,dz=tp.z-pz,Ld=Math.hypot(dx,dz);
    for(let t=1.2;t<=Ld+0.6;t+=0.8){const q=Math.min(1,t/Ld);if(camBlocked(px+dx*q,pz+dz*q,py+dy*q)){const f=Math.max(0.2,(t-1.4)/Ld);tp.set(px+dx*f,py+dy*f+(1-f)*1.2,pz+dz*f);break;}}}
  if(S.cam===3){tl.set(r.x+rx*0.8,r.h+1.0,r.z+rz*0.8);}
  const k=1-Math.exp(-dt*5);camPos.lerp(tp,k);camLook.lerp(tl,k);
  const groundH=finalHeight(camPos.x,camPos.z)+0.8;if(camPos.y<groundH)camPos.y=groundH;
  camera.position.copy(camPos);
  // Tempo-Gefühl: leichtes Rubbeln der Straße ab ca. 20 km/h, auf Pflaster deutlich mehr
  {const kmh=S.v*3.6,t=performance.now()/1000,a=(0.012*sat((kmh-20)/30)+0.015*SND.cobble*sat(kmh/15))*(S.paused?0:1);
    if(a>0.0005){camera.position.y+=a*(Math.sin(t*71)+0.6*Math.sin(t*113+1.3));camera.position.x+=a*0.5*Math.sin(t*89+0.7);camera.position.z+=a*0.5*Math.sin(t*97+2.1);}}
  camera.lookAt(camLook);
  // Sichtfeld weitet sich mit dem Tempo (bei 50 km/h ca. 9°, bei 65 km/h ca. 13° mehr)
  const fov=58+clamp(S.v*3.6-18,0,47)*0.28;if(Math.abs(camera.fov-fov)>0.05){camera.fov+=(fov-camera.fov)*k;camera.updateProjectionMatrix();}
}
function updateEnv(dt,t){
  water.material.uniforms.time.value=t;
  sky.position.copy(camera.position);
  const tgt=S.started?player.position:camLook;
  sun.target.position.copy(tgt);sun.position.copy(tgt).addScaledVector(SUN_DIR,500);
  if(lavaLight){const fl=0.85+0.15*Math.sin(t*2.1)+0.08*Math.sin(t*5.3);lavaLight.intensity=2.4*fl;lavaMat.color.setRGB(1,0.33+0.08*fl,0.1);}
  if(LABELS.length&&(!updateEnv.lt||t-updateEnv.lt>0.4)){updateEnv.lt=t;const fw=new THREE.Vector3();camera.getWorldDirection(fw);
    const c=LABELS.map(lb=>{const v=lb.position.clone().sub(camera.position),d=v.length();return {lb,d,ok:d>50&&d<(S.started?850:1600)&&v.dot(fw)/d>0.25};}).filter(o=>{o.lb.visible=false;return o.ok;}).sort((a,b)=>a.d-b.d);
    c.slice(0,S.started?4:8).forEach(o=>o.lb.visible=true);}
  for(const sp of smoke){const u=sp.userData;u.age+=dt*0.035;if(u.age>1){u.age=0;u.ox=rnd(-30,30);u.oz=rnd(-30,30);}
    const a=u.age;sp.position.set(VOLC.x+u.ox+a*260,u.base+a*620,VOLC.z+u.oz+a*90);const s=60+a*320;sp.scale.set(s,s,1);sp.material.opacity=0.55*Math.sin(Math.PI*a);}
  for(const b of boats){b.position.y=0.25+Math.sin(t*1.1+b.userData.seed)*0.25;b.rotation.z=Math.sin(t*0.9+b.userData.seed)*0.05;}
  for(const c of clouds){c.position.x+=dt*4;if(c.position.x>9500)c.position.x=-9500;}
}
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  sndStep(now);if(REBUILD)return;
  const idle=!S.started||S.paused||!$('setup').classList.contains('hidden')||!$('statsView').classList.contains('hidden'),cap=idle?30:(S.fps||60);
  if(now-PERF.lastF<1000/cap-1.5)return;PERF.lastF=now;perfTick(now);const dt=Math.min(0.1,(now-last)/1000);last=now;const t=now/1000;
  if(S.riding&&!S.paused)stepPhysics(dt);
  placeRider(player,S.dist,0.8,S.v);animRider(player,S.legPhase,S.wheel,{v:S.v,w:(T.pedaling?S.power:0)/S.mass,g:gradeAt(S.dist)});
  for(const b of BOTS){if(!b.active)continue;placeRider(b.obj,b.dist,b.lat,b.v);const d2=b.obj.position.distanceToSquared(camera.position);b.obj.visible=d2<320*320;if(d2<200*200)animRider(b.obj,b.phase,b.wheel,{v:b.v,w:b.wkg,g:gradeAt(b.dist)});if(b.obj.userData.label)b.obj.userData.label.visible=d2>36;}
  stepLife(dt,t);
  netStep(dt,now);updateCamera(dt);updateEnv(dt,t);animExtras(dt,t);updateGrass();updateCull();if(S.started)updateMap(now);if(S.started)updateHud(now);
  if(++PERF.sf%2===0||!S.started)renderer.shadowMap.needsUpdate=true;
  renderFrame();
}

/* ================= UI-Verdrahtung ================= */
function openMenu(){$('setup').classList.remove('hidden');if(S.started)S.paused=true;requestAnimationFrame(drawRouteCards);}
// Vollbild (Fullscreen-API; das iPhone erlaubt Webseiten kein echtes Vollbild)
function fsActive(){return !!(document.fullscreenElement||document.webkitFullscreenElement);}
function toggleFullscreen(){const d=document.documentElement,req=d.requestFullscreen||d.webkitRequestFullscreen;
  if(fsActive()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}
  const no=()=>toast(/iPhone|iPod/.test(navigator.userAgent)?'📱 Das iPhone erlaubt Webseiten kein Vollbild. Tipp: Handy quer halten, dann werden die Browser-Leisten kleiner.':'Dieser Browser unterstützt keinen Vollbildmodus.');
  if(!req){no();return;}
  try{const r=req.call(d,{navigationUI:'hide'});if(r&&r.catch)r.catch(no);}catch(e){no();}}
function updateFsUi(){const on=fsActive();document.body.classList.toggle('fs',on);
  for(const id of ['fsBtn','bFs']){const b=$(id);if(b)b.title=on?'Vollbild beenden (F)':'Vollbild (F)';}
  $('bFs').textContent=on?'Vollbild beenden':'Vollbild';}
function closeMenu(){$('setup').classList.add('hidden');S.paused=false;}
function readInputs(){S.mass=clamp(+$('iWeight').value||75,30,160);S.chain=clamp(+$('iChain').value||50,20,60);S.cog=clamp(+$('iCog').value||17,10,36);
  S.diff=(+$('iDiff').value)/100;
  S.rings=$('iRings').value;S.cassette=$('iCas').value;S.gearMode=$('iGearMode').value;S.repeat=+$('iRepeat').value;S.smooth=+$('iSmooth').value;applyQuality();rebuildGears();saveSettings();sendResistance(true);}
function startRide(sim){
  readInputs();S.sim=sim;$('simBox').classList.toggle('hidden',!sim);updateGear();
  if(!S.started){S.started=true;S.riding=true;const r=roadAt(-7);camPos.set(r.x,r.h+3,r.z);camLook.set(r.x,r.h,r.z);}
  $('hud').classList.remove('hidden');$('bStart').textContent='Weiterfahren';$('bSim').classList.add('hidden');$('bStats').classList.remove('hidden');$('bEnd').classList.remove('hidden');closeMenu();
  if(!sim&&!T.dev)status('Kein Trainer verbunden – Menü (☰) öffnen oder „Ohne Trainer testen“ wählen.');
  else if(!sim&&!T.cp)status('Trainer liefert nur Daten, Widerstand kann nicht gesteuert werden.');else status('');
  sendResistance(true);
}
function switchTo(world,route){rebuildWorld(world,route,world!==WORLD?'Welt wird gewechselt …':'Route wird gebaut …');}
function routeInfos(){
  if(IS_ULM)return ULM.routes.map(r=>({id:r.id,name:r.name,desc:r.desc,len:r.len,gain:r.gain,climbs:r.climbs.length,h:r.h}));
  return KALEA_ROUTES.map(def=>{const g=def===ROUTE?{L,gain:LAPCLIMB,RH}:kaleaGeom(def);return {id:def.id,name:def.name,desc:def.desc,len:g.L,gain:g.gain,climbs:def===ROUTE?CLIMBS.length:null,h:Array.from(g.RH)};});}
function buildRouteMenu(){
  document.querySelectorAll('.world').forEach(b=>{b.classList.toggle('on',b.dataset.world===WORLD);b.onclick=()=>{if(b.dataset.world!==WORLD)switchTo(b.dataset.world);};});
  const list=routeInfos();
  $('routeList').innerHTML=list.map(r=>`<button class="route ${r.id===ROUTE.id?'on':''}" data-id="${r.id}"><b>${r.name}</b><span class="rd">${r.desc}</span>
    <span class="chips"><span class="chip">${(r.len/1000).toFixed(1)} km</span><span class="chip">${Math.round(r.gain)} hm</span>${r.climbs!==null?`<span class="chip">${r.climbs?r.climbs+(r.climbs>1?' Anstiege':' Anstieg'):'flach'}</span>`:''}</span><canvas></canvas></button>`).join('');
  document.querySelectorAll('.route').forEach(b=>{b.onclick=()=>{if(b.dataset.id!==ROUTE.id)switchTo(WORLD,b.dataset.id);};});
  ROUTE_H=list.map(r=>r.h);requestAnimationFrame(drawRouteCards);}
// Mini-Höhenprofile der Routen (nur zeichenbar, wenn das Menü sichtbar ist)
let ROUTE_H=[];
function drawRouteCards(){document.querySelectorAll('.route').forEach((b,k)=>{
    {const c=b.querySelector('canvas'),h=ROUTE_H[k],dpr=Math.min(devicePixelRatio,2),W=c.clientWidth,H=c.clientHeight;if(!W||!h)return;c.width=W*dpr;c.height=H*dpr;
      const x=c.getContext('2d');x.scale(dpr,dpr);let mn=1e9,mx=-1e9;for(const v of h){mn=Math.min(mn,v);mx=Math.max(mx,v);}const rng=Math.max(60,mx-mn);
      x.beginPath();x.moveTo(0,H);const st=Math.max(1,Math.floor(h.length/W));for(let i=0;i<h.length;i+=st)x.lineTo(i/h.length*W,H-2-(h[i]-mn)/rng*(H-5));x.lineTo(W,H);x.closePath();
      x.fillStyle='#f48fa8';x.fill();x.lineWidth=2;x.strokeStyle='#1e0f3a';x.stroke();}});}
function wireUi(){
  if(!navigator.bluetooth)$('bleWarn').classList.remove('hidden');
  $('iWeight').value=S.mass;$('iChain').value=S.chain;$('iCog').value=S.cog;$('iDiff').value=Math.round(S.diff*100);$('vDiff').textContent=Math.round(S.diff*100)+' %';$('iQual').value=S.quality;
  $('iRings').value=S.rings;$('iCas').value=S.cassette;$('iGearMode').value=S.gearMode;$('iRepeat').value=String(S.repeat);$('iSmooth').value=String(S.smooth);
  $('iCasPreset').innerHTML='<option value="">Eigene Eingabe</option>'+CAS_PRESETS.map(([n,v],i)=>`<option value="${i}">${n}</option>`).join('');
  {const i=CAS_PRESETS.findIndex(x=>x[1]===S.cassette);$('iCasPreset').value=i<0?'':String(i);}
  $('iCasPreset').onchange=()=>{const v=$('iCasPreset').value;if(v!==''){$('iCas').value=CAS_PRESETS[+v][1];readInputs();}};
  $('iCas').oninput=()=>{const i=CAS_PRESETS.findIndex(x=>x[1]===$('iCas').value.replace(/\s/g,''));$('iCasPreset').value=i<0?'':String(i);};
  $('iDiff').oninput=()=>{$('vDiff').textContent=$('iDiff').value+' %';};
  ['iWeight','iChain','iCog','iDiff','iRings','iCas','iGearMode','iRepeat','iSmooth'].forEach(id=>$(id).onchange=readInputs);
  $('iQual').onchange=()=>{S.quality=$('iQual').value;if(IS_MOBILE)S.qualitySetOnMobile=true;saveSettings();CHUNK=S.quality==='low'?900:500;rebuildWorld(WORLD,ROUTE.id,'Grafik wird angepasst …');};
  $('iShiftMode').onchange=()=>{S.vshift=$('iShiftMode').value==='click';saveSettings();applyShiftMode();sendResistance(true);};
  $('devGo').onclick=closeDevices;$('devSim').onclick=()=>{closeDevices();startRide(true);};
  $('bTrainer').onclick=connectTrainer;$('bClick').onclick=connectClick;$('bHr').onclick=connectHr;$('bCad').onclick=connectCad;
  $('bStart').onclick=()=>startRide(false);$('bSim').onclick=()=>startRide(true);
  $('menuBtn').onclick=openMenu;$('fsBtn').onclick=toggleFullscreen;$('sndBtn').onclick=toggleMute;
  $('iBotMode').value=S.botMode;$('iBotWkg').value=S.botWkg;$('iLife').checked=S.life;
  $('iBotMode').onchange=()=>{const was=S.botMode;S.botMode=$('iBotMode').value;saveSettings();applyBotVis();if(was==='off'||was==='solo')placeBotsStart();};
  $('iBotWkg').onchange=()=>{S.botWkg=clamp(+$('iBotWkg').value||2.5,1,6);$('iBotWkg').value=S.botWkg;saveSettings();};
  $('iLife').onchange=()=>{S.life=$('iLife').checked;saveSettings();applyLifeVis();};
  $('iSndBike').value=Math.round(S.sndBike*100);$('iSndAmb').value=Math.round(S.sndAmb*100);sndVolume();
  $('iSndBike').oninput=()=>{S.sndBike=$('iSndBike').value/100;sndVolume();};$('iSndAmb').oninput=()=>{S.sndAmb=$('iSndAmb').value/100;sndVolume();};
  $('iSndBike').onchange=$('iSndAmb').onchange=()=>{saveSettings();if(S.sndBike>0)sndPlay('up1',0.6,1);};$('bFs').onclick=toggleFullscreen;
  document.addEventListener('fullscreenchange',updateFsUi);document.addEventListener('webkitfullscreenchange',updateFsUi);
  addEventListener('resize',()=>{if(!$('setup').classList.contains('hidden'))requestAnimationFrame(drawRouteCards);});$('gUp').onclick=()=>shift(1);$('gDown').onclick=()=>shift(-1);
  $('lUp').onclick=()=>startLearn('up');$('lDown').onclick=()=>startLearn('down');
  $('lReset').onclick=()=>{Z.learned={up:null,down:null};saveSettings();$('learnState').textContent='Zuordnung zurückgesetzt.';};
  $('simPow').oninput=()=>{S.simPower=+$('simPow').value;$('simPowV').textContent=S.simPower;};
  rebuildGears(VGEARS[12]);applyShiftMode();
  buildRouteMenu();wireNet();wireOsm();
  $('bStats').onclick=()=>showStats(REC.ended);$('statBtn').onclick=()=>showStats(REC.ended);$('bEnd').onclick=endRide;
  try{const mm=localStorage.getItem('kalea_map');if(mm)MAP.mode=mm;}catch(e){}applyMapMode();
  $('mapC').onclick=cycleMap;$('mapMode').onclick=cycleMap;
  $('mapDet').addEventListener('toggle',()=>{if($('mapDet').open)requestAnimationFrame(()=>drawMap($('bigMap'),{mode:'route',big:true}));});
  $('komTable').innerHTML=komTable();$('komDet').addEventListener('toggle',()=>{$('komTable').innerHTML=komTable();});
  $('bKomReset').onclick=()=>{const b=$('bKomReset');if(!b.dataset.arm){b.dataset.arm='1';b.textContent='Wirklich löschen? Nochmal tippen';setTimeout(()=>{delete b.dataset.arm;b.textContent='Bestzeiten dieser Welt löschen';},4000);return;}delete b.dataset.arm;b.textContent='Bestzeiten dieser Welt löschen';const st=komStore();for(const k in st)if(st[k].world===WORLD)delete st[k];komSave();$('komTable').innerHTML=komTable();};
  showTrainerGear();$('iTire').value=S.tire.toFixed(3);$('iTire').onchange=()=>{S.tire=+$('iTire').value;PHYS.circ=S.tire;saveSettings();updateGear();};
  $('iFps').value=String(S.fps);$('iFps').onchange=()=>{S.fps=+$('iFps').value;saveSettings();};
  $('iFeel').value=S.feel;$('iFeel').onchange=()=>{S.feel=$('iFeel').value;applyFeel();saveSettings();};
  $('iShiftFeel').value=S.shiftFeel;$('iShiftFeel').onchange=()=>{S.shiftFeel=$('iShiftFeel').value;saveSettings();};
  $('iToon').value=S.toon?'1':'0';$('iToon').onchange=()=>{S.toon=$('iToon').value==='1';saveSettings();};
  $('iFtp').value=S.ftp;$('iErgW').value=S.ergW;$('iErg').checked=S.erg;
  $('iWo').innerHTML=WORKOUTS.map(w=>`<option value="${w.id}">${w.cat}: ${w.name} (${Math.round(woDuration(w)/60)} min)</option>`).join('');
  const prev=()=>{const wo=WORKOUTS.find(w=>w.id===$('iWo').value);$('vWo').textContent=wo.desc;drawWorkoutOn($('woPreview'),wo,null,0);};
  $('iWo').onchange=prev;setTimeout(prev,50);
  $('iFtp').onchange=()=>{S.ftp=clamp(+$('iFtp').value||250,80,600);saveSettings();prev();};
  $('iErgW').onchange=()=>{S.ergW=clamp(+$('iErgW').value||200,50,1200);saveSettings();updateErgUi();sendResistance(true);};
  $('iErg').onchange=()=>{S.erg=$('iErg').checked;updateErgUi();sendResistance(true);};
  $('bWo').onclick=()=>{W.ergOn=$('iWoErg').checked;startWorkout($('iWo').value);if(!S.started)startRide(!T.dev);else closeMenu();};
  $('woStop').onclick=stopWorkout;
  $('ergPlus').onclick=()=>ergNudge(1);$('ergMinus').onclick=()=>ergNudge(-1);
  $('ergToggle').onclick=()=>{if(W.active&&!W.done)W.ergOn=!W.ergOn;else{S.erg=!S.erg;$('iErg').checked=S.erg;}updateErgUi();sendResistance(true);};
  addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;const k=e.key;
    if(k==='ArrowUp'||k==='+'||k==='='){shift(1);e.preventDefault();}
    else if(k==='ArrowDown'||k==='-'){shift(-1);e.preventDefault();}
    else if((k==='w'||k==='W')&&S.sim){S.simPower=clamp(S.simPower+10,0,600);$('simPow').value=S.simPower;$('simPowV').textContent=S.simPower;}
    else if((k==='s'||k==='S')&&S.sim){S.simPower=clamp(S.simPower-10,0,600);$('simPow').value=S.simPower;$('simPowV').textContent=S.simPower;}
    else if(k==='c'||k==='C')S.cam=(S.cam+1)%VIEWS.length;
    else if(k==='m'||k==='M')cycleMap();
    else if(k==='f'||k==='F')toggleFullscreen();
    else if(k==='t'||k==='T')toggleMute();
    else if(k==='i'||k==='I'){if($('statsView').classList.contains('hidden'))showStats(REC.ended);else closeStats();}
    else if(k==='e'||k==='E'){$('ergToggle').click();}
    else if(k==='Escape'){if(!$('devDlg').classList.contains('hidden')){closeDevices();return;}if(!$('statsView').classList.contains('hidden')){closeStats();return;}if($('setup').classList.contains('hidden'))openMenu();else if(S.started)closeMenu();}});
}

/* ================= Leben am Rand: Fußgänger, Hunde, Menschen, Tiere, Boote, Autos ================= */
// Alles einfache Comic-Figuren als InstancedMesh; bewegt wird nur, was in deiner Nähe ist. S.life schaltet es ab.
const LIFE={walk:[],wm:null,ducks:[],duckMs:[],dolph:[],rboats:[],statics:[]};
const SHIRTS=[0xd62f2f,0xf2c230,0x2e7dd7,0xffffff,0x2bb673,0xff7a1a,0x7a4fd6,0xff8fb8,0x3ec1d3,0x1e2a44,0x8a8f99],SKINS=[0xf1c9a5,0xe2b48d,0xc68e62,0x8d5a3b,0xf6d7bd],
  PANTS=[0x2a3a5a,0x3a3a3a,0x6b4b2e,0x1f5f8b,0x55606e,0xc9b27a];
const pick=a=>a[Math.random()*a.length|0];
function lifeMat(vc){return new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:!!vc,roughness:0.8});}
// Figur (Blick in +z): Oberkörper mit Armen, Kopf mit Händen, Beine einzeln (Drehpunkt an der Hüfte) oder zusammen
// Menschen (Fußgänger, Zuschauer, Leute auf Plätzen): drei Farbgruppen je Figur (Oberteil, Haut + Haare, Hose + Schuhe),
// damit jede Figur mit drei Instanz-Farben auskommt. Haare/Schuhe sind dunkel in die Eckpunktfarben eingefärbt.
function personParts(armsUp){const lath=(prof,seg)=>{const g=new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(r,y)),seg);return g;};
  const shirtP=[],skinP=[],legP=[];
  {const t=lath([[0.001,0.86],[0.16,0.87],[0.165,0.98],[0.15,1.12],[0.175,1.3],[0.17,1.4],[0.1,1.47],[0.001,1.48]],10);t.scale(1.15,1,0.72);shirtP.push([tr(t),0xffffff]);}
  for(const s of [1,-1]){
    if(armsUp){shirtP.push([tube([s*0.19,1.4,0],[s*0.3,1.62,0.02],0.055,6),0xffffff]);skinP.push([tube([s*0.3,1.62,0.02],[s*0.38,1.9,0.05],0.045,6),0xffffff]);
      skinP.push([tr(new THREE.IcosahedronGeometry(0.05,0),[s*0.39,1.95,0.05]),0xffffff]);}
    else{shirtP.push([tube([s*0.2,1.4,0],[s*0.23,1.13,0.0],0.055,6),0xffffff]);skinP.push([tube([s*0.23,1.13,0],[s*0.235,0.84,0.04],0.043,6),0xffffff]);
      skinP.push([tr(new THREE.IcosahedronGeometry(0.048,0),[s*0.235,0.8,0.05]),0xffffff]);}}
  skinP.push([tube([0,1.46,0],[0,1.56,0.01],0.05,6),0xffffff]);
  {const h=new THREE.SphereGeometry(0.11,10,8);h.scale(0.9,1.06,1);skinP.push([tr(h,[0,1.65,0.01]),0xffffff]);
    const nose=new THREE.ConeGeometry(0.018,0.045,4);nose.rotateX(Math.PI/2);skinP.push([tr(nose,[0,1.64,0.12]),0xffffff]);
    const hair=new THREE.SphereGeometry(0.117,10,6,0,Math.PI*2,0,Math.PI*0.5);hair.scale(0.92,1.0,1.05);skinP.push([tr(hair,[0,1.665,-0.004],[-0.25,0,0]),0x4a3424]);}
  const leg=x=>{const g=[];g.push([tube([x,0.86,0],[x*1.1,0.06,0],0.072,7),0xffffff]);g.push([tr(new THREE.BoxGeometry(0.1,0.08,0.24),[x*1.1,0.04,0.05]),0x2a2a2e]);return g;};
  const legOne=[[tube([0,0,0],[0,-0.8,0],0.072,7),0xffffff],[tr(new THREE.BoxGeometry(0.1,0.08,0.24),[0,-0.82,0.05]),0x2a2a2e]];
  return {shirt:merge(shirtP),skin:merge(skinP),legs:merge([...leg(0.095),...leg(-0.095),[tr(new THREE.SphereGeometry(0.16,8,6),[0,0.86,0],[0,0,0],[1.1,0.6,0.8]),0xffffff]]),leg:merge(legOne)};}
function personGeos(){return personGeos.g||(personGeos.g=personParts(false));}
function dogGeo(){const C=(r,h)=>new THREE.CylinderGeometry(r,r,h,5);
  return mergeGeos([tr(new THREE.BoxGeometry(0.28,0.28,0.62),[0,0.42,0]),tr(new THREE.BoxGeometry(0.22,0.22,0.26),[0,0.62,0.38]),tr(new THREE.BoxGeometry(0.12,0.1,0.14),[0,0.57,0.56]),
    tr(new THREE.BoxGeometry(0.06,0.1,0.04),[0.08,0.76,0.36]),tr(new THREE.BoxGeometry(0.06,0.1,0.04),[-0.08,0.76,0.36]),
    tr(C(0.04,0.3),[0.1,0.15,0.22]),tr(C(0.04,0.3),[-0.1,0.15,0.22]),tr(C(0.04,0.3),[0.1,0.15,-0.22]),tr(C(0.04,0.3),[-0.1,0.15,-0.22]),tr(C(0.025,0.3),[0,0.6,-0.4],[-0.8,0,0])]);}
// Stimmt der Punkt mit einem echten OSM-Haus überein? (Grundrisse mit Begrenzungsrahmen)
function inOsm(x,z){for(const P of MAPPOLY){let bb=P.bb;if(!bb){bb=P.bb=[1e9,1e9,-1e9,-1e9];for(const q of P){bb[0]=Math.min(bb[0],q[0]);bb[1]=Math.min(bb[1],q[1]);bb[2]=Math.max(bb[2],q[0]);bb[3]=Math.max(bb[3],q[1]);}}
    if(x<bb[0]-1||x>bb[2]+1||z<bb[1]-1||z>bb[3]+1)continue;let c=false;
    for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}if(c)return true;}return false;}
function nearOsm(x,z,r){return inOsm(x,z)||inOsm(x+r,z)||inOsm(x-r,z)||inOsm(x,z+r)||inOsm(x,z-r);}
function freeSpot(x,z,road){return !nearestRoad(x,z,road||5.5)&&occFree(x,z,0,1,1)&&(!IS_ULM||(riverDist(x,z).d>RIVER_HW+5&&!inOsm(x,z)))&&(IS_ULM||rawHeight(x,z)>0.15);}

// ---- Fußgänger und Jogger am Straßenrand (manche mit Hund), immer in deiner Nähe ----
const _wo=new THREE.Object3D(),_wl=new THREE.Object3D(),_wd=new THREE.Object3D(),_Z0=new THREE.Matrix4().makeScale(0,0,0);_wo.add(_wl,_wd);
function buildWalkers(n){const G=personGeos(),mk=(geo,vc=true)=>{const m=new THREE.InstancedMesh(geo,lifeMat(vc),n);m.castShadow=true;m.frustumCulled=false;scene.add(m);LIFE.statics.push(m);return m;};
  const W=LIFE.wm={shirt:mk(G.shirt),skin:mk(G.skin),legL:mk(G.leg),legR:mk(G.leg),dog:mk(dogGeo(),false)},col=new THREE.Color();
  for(let k=0;k<n;k++){const pants=pick(PANTS);W.shirt.setColorAt(k,col.set(pick(SHIRTS)));W.skin.setColorAt(k,col.set(pick(SKINS)));W.legL.setColorAt(k,col.set(pants));W.legR.setColorAt(k,col.set(pants));
    W.dog.setColorAt(k,col.set(pick([0x8a5a36,0x2b2422,0xe8dcc8,0xc8913c,0x6b6b6b])));for(const m of Object.values(W))m.setMatrixAt(k,_Z0);
    LIFE.walk.push({k,d:0,off:0,dir:1,sp:1,jog:false,dog:false,ph:rnd(0,6.28),s:1,y:0,yd:-1e9,hide:true,init:false});}}
function respawnWalker(w,first){
  for(let t=0;t<8;t++){const d=S.dist+(first?rnd(-60,650):rnd(150,650)),off=(Math.random()<0.5?-1:1)*rnd(7.0,8.6),r=roadAt(d),x=r.x-r.tz*off,z=r.z+r.tx*off;
    if(IS_ULM&&Math.random()>0.2+0.8*ulmZone(x,z).d)continue; // in der Stadt mehr Leute
    if(!freeSpot(x,z))continue;
    Object.assign(w,{d,off,dir:Math.random()<0.5?1:-1,jog:Math.random()<0.3,hide:false,yd:-1e9,s:rnd(0.9,1.08)});w.sp=w.jog?rnd(2.3,3.1):rnd(1.0,1.5);w.dog=!w.jog&&Math.random()<0.35;return;}
  w.hide=true;}
function stepWalkers(dt){const W=LIFE.wm;if(!W)return;const on=S.life&&S.started;for(const m of Object.values(W))m.visible=on;if(!on)return;
  for(const w of LIFE.walk){
    if(!w.init){w.init=true;respawnWalker(w,true);}
    else if(w.hide){if(Math.random()<dt*0.5)respawnWalker(w);}
    else{w.d+=w.dir*w.sp*dt;if(w.d<S.dist-80||w.d>S.dist+900)respawnWalker(w);}
    if(w.hide){for(const m of Object.values(W))m.setMatrixAt(w.k,_Z0);continue;}
    let r=roadAt(w.d),x=r.x-r.tz*w.off,z=r.z+r.tx*w.off;
    if(Math.abs(w.d-w.yd)>2){if(!freeSpot(x,z,4.5)){w.dir=-w.dir;w.d+=w.dir*2.5;r=roadAt(w.d);x=r.x-r.tz*w.off;z=r.z+r.tx*w.off;} // vor Wasser/Haus umdrehen
      w.y=groundH(x,z)-0.03;w.yd=w.d;}
    w.ph+=dt*w.sp*(w.jog?2.4:3.4);const sw=Math.sin(w.ph)*(w.jog?0.7:0.42),bob=Math.abs(Math.cos(w.ph))*(w.jog?0.07:0.03);
    _wo.position.set(x,w.y+bob,z);_wo.rotation.set(w.jog?0.12:0,Math.atan2(r.tx,r.tz)+(w.dir<0?Math.PI:0),0,'YXZ');_wo.scale.setScalar(w.s);_wo.updateMatrixWorld(true);
    W.shirt.setMatrixAt(w.k,_wo.matrixWorld);W.skin.setMatrixAt(w.k,_wo.matrixWorld);
    _wl.position.set(0.095,0.86,0);_wl.rotation.set(sw,0,0);_wl.updateMatrixWorld(true);W.legL.setMatrixAt(w.k,_wl.matrixWorld);
    _wl.position.set(-0.095,0.86,0);_wl.rotation.set(-sw,0,0);_wl.updateMatrixWorld(true);W.legR.setMatrixAt(w.k,_wl.matrixWorld);
    if(w.dog){_wd.position.set(0.55,-bob+Math.abs(Math.sin(w.ph*1.3))*0.04,0.9);_wd.rotation.set(0,Math.sin(w.ph*0.4)*0.2,0);_wd.updateMatrixWorld(true);W.dog.setMatrixAt(w.k,_wd.matrixWorld);}
    else W.dog.setMatrixAt(w.k,_Z0);}
  for(const m of Object.values(W))m.instanceMatrix.needsUpdate=true;}

// ---- Stehende Menschen (Plätze, Strand) ----
function staticPeople(list){const G=personGeos(),a=[],b=[],c=[];
  for(const p of list){const s=rnd(0.9,1.06),base={x:p.x,z:p.z,y:p.y!==undefined?p.y:groundH(p.x,p.z)-0.03,sx:s,sy:s,sz:s,ry:p.ry!==undefined?p.ry:rnd(0,6.28),rx:p.rx||0};
    a.push({...base,c:pick(SHIRTS)});b.push({...base,c:pick(SKINS)});c.push({...base,c:pick(PANTS)});}
  if(list.length)LIFE.statics.push(...chunkedInstances(G.shirt,lifeMat(true),a),...chunkedInstances(G.skin,lifeMat(true),b),...chunkedInstances(G.legs,lifeMat(true),c));}
function scatterPeople(L,cx,cz,w,h,n,ok){for(let t=0,c=0;t<n*15&&c<n;t++){const x=cx+rnd(-w,w),z=cz+rnd(-h,h);if(!freeSpot(x,z)||(ok&&!ok(x,z)))continue;L.push({x,z});c++;}}
function peopleUlm(){const P=ULM.places,L=[],m=P.muenster;
  scatterPeople(L,m[0]-135,m[1],60,55,28,(x,z)=>!(Math.abs(x-m[0]-2)<76&&Math.abs(z-m[1])<31)); // Münsterplatz (westlich vom Münster)
  scatterPeople(L,P.rathaus[0],P.rathaus[1]-31,45,35,12,(x,z)=>footFree(x,z,0.5));            // Marktplatz am Rathaus
  if(P.friedrichsau)scatterPeople(L,P.friedrichsau[0],P.friedrichsau[1],160,120,20,(x,z)=>footFree(x,z,1)); // Park
  staticPeople(L);}
function beachLife(){const L=[],towels=[],umbr=[],crabs=[],step=Math.round(40/ds);
  for(let i=0;i<N;i+=step)for(const sd of [-1,1]){if(Math.random()>0.5)continue;let x=0,z=0,h=9;
    for(let o=20;o<=450;o+=10){[x,z]=lateralPoint(i,sd*o);h=rawHeight(x,z);if(h<1.6)break;} // nach außen bis zum Sand
    if(h<0.2||h>1.6||nearestRoad(x,z,12))continue;
    const ry=rnd(0,6.28),n=2+(Math.random()*2|0);umbr.push({x,z,y:groundH(x,z)-0.1,ry,sx:1,sy:1,sz:1,c:pick([0xe8463c,0xf2c230,0x3ec1d3,0xff8fb8,0x7ad35a,0xffffff])});
    for(let q=0;q<n;q++){const px=x+Math.cos(ry+q*2.1)*1.6,pz=z+Math.sin(ry+q*2.1)*1.6,gy=groundH(px,pz);
      if(Math.random()<0.55){towels.push({x:px,z:pz,y:gy+0.01,ry:ry+q,sx:1,sy:1,sz:1,c:pick(SHIRTS)});L.push({x:px,z:pz,y:gy+0.2,ry:ry+q,rx:-Math.PI/2});}  // liegt auf dem Handtuch
      else L.push({x:px,z:pz});}
    for(let q=0;q<2;q++){const cx2=x+rnd(-8,8),cz2=z+rnd(-8,8),ch=rawHeight(cx2,cz2);if(ch>0.05&&ch<1.2)crabs.push({x:cx2,z:cz2,y:groundH(cx2,cz2),ry:rnd(0,6.28),sx:1,sy:1,sz:1,c:0xffffff});}}
  staticPeople(L);
  LIFE.statics.push(...chunkedInstances(new THREE.BoxGeometry(0.9,0.03,1.9),lifeMat(),towels,{shadow:false}));
  LIFE.statics.push(...chunkedInstances(merge([[tr(new THREE.CylinderGeometry(0.03,0.03,2.2,5),[0,1.1,0]),0xffffff],[tr(new THREE.ConeGeometry(1.15,0.5,10),[0,2.3,0]),0xffffff]]),lifeMat(true),umbr));
  const crab=merge([[tr(new THREE.IcosahedronGeometry(0.13,0),[0,0.06,0],[0,0,0],[1.3,0.45,1]),0xd8452e],[tr(new THREE.IcosahedronGeometry(0.05,0),[0.17,0.06,0.1]),0xe0553a],[tr(new THREE.IcosahedronGeometry(0.05,0),[-0.17,0.06,0.1]),0xe0553a]]);
  LIFE.statics.push(...chunkedInstances(crab,lifeMat(true),crabs,{shadow:false}));
  // Fischerdorf
  const F=[],r=roadAt(500);for(let t=0;t<200&&F.length<14;t++){const i=(Math.round((500+rnd(-70,70))/ds)+N)%N,[x,z]=lateralPoint(i,(Math.random()<0.5?-1:1)*rnd(8,32));if(rawHeight(x,z)>0.8&&freeSpot(x,z))F.push({x,z});}
  staticPeople(F);}

// ---- Tiere ----
function herd(geo,count,ok,cols,group,kind){const items=[];let tries=0;
  while(items.length<count&&tries<count*60){tries++;const i=Math.random()*N|0,[x,z]=lateralPoint(i,(Math.random()<0.5?-1:1)*rnd(25,110));if(!ok(x,z))continue;
    for(let q=0;q<group&&items.length<count;q++){const sx=x+rnd(-12,12),sz=z+rnd(-12,12);if(nearestRoad(sx,sz,12)||!ok(sx,sz)||(IS_ULM&&nearOsm(sx,sz,8)))continue;const s=rnd(0.9,1.1);
      items.push({x:sx,z:sz,y:groundH(sx,sz)-0.05,ry:rnd(0,6.28),sx:s,sy:s,sz:s,c:pick(cols)});}}
  const ms=chunkedInstances(geo,lifeMat(true),items);for(const m of ms)m.userData.kind=kind;LIFE.statics.push(...ms);}
function cowGeo(){const L=(x,z)=>[tr(new THREE.CylinderGeometry(0.07,0.07,0.65,5),[x,0.33,z]),0xf0f0f0];
  return merge([[tr(new THREE.BoxGeometry(0.65,0.75,1.5),[0,1.0,0]),0xf4f4f0],[tr(new THREE.BoxGeometry(0.67,0.5,0.6),[0,1.08,0.15]),0x2a2422],[tr(new THREE.BoxGeometry(0.67,0.35,0.35),[0,0.95,-0.5]),0x2a2422],
    [tr(new THREE.BoxGeometry(0.36,0.4,0.45),[0,1.15,0.95]),0xf4f4f0],[tr(new THREE.BoxGeometry(0.3,0.22,0.2),[0,1.03,1.2]),0xe8b4a8],[tr(new THREE.BoxGeometry(0.5,0.06,0.06),[0,1.38,0.9]),0xe8e0c8],
    L(0.22,0.55),L(-0.22,0.55),L(0.22,-0.55),L(-0.22,-0.55)]);}
function horseGeo(){const L=(x,z)=>[tr(new THREE.CylinderGeometry(0.06,0.06,0.95,5),[x,0.48,z]),0x5a3a22];
  return merge([[tr(new THREE.BoxGeometry(0.5,0.6,1.5),[0,1.22,0]),0x8a5a36],[tr(new THREE.BoxGeometry(0.3,0.75,0.3),[0,1.6,0.75],[0.6,0,0]),0x8a5a36],
    [tr(new THREE.BoxGeometry(0.25,0.25,0.6),[0,1.9,1.05],[0.4,0,0]),0x8a5a36],[tr(new THREE.BoxGeometry(0.08,0.6,0.08),[0,1.0,-0.8],[-0.3,0,0]),0x2a1a12],[tr(new THREE.BoxGeometry(0.06,0.6,0.35),[0,1.85,0.68],[0.6,0,0]),0x2a1a12],
    L(0.17,0.55),L(-0.17,0.55),L(0.17,-0.55),L(-0.17,-0.55)]);}
function storkGeo(){return merge([[tr(new THREE.IcosahedronGeometry(0.3,1),[0,1.0,0],[0,0,0],[0.7,0.7,1.3]),0xf6f6f2],[tr(new THREE.BoxGeometry(0.44,0.18,0.5),[0,1.02,-0.18]),0x1e1e1e],
    [tr(new THREE.CylinderGeometry(0.04,0.05,0.45,5),[0,1.3,0.28],[0.5,0,0]),0xf6f6f2],[tr(new THREE.IcosahedronGeometry(0.08,0),[0,1.5,0.38]),0xf6f6f2],[tr(new THREE.ConeGeometry(0.03,0.3,5),[0,1.47,0.55],[Math.PI/2,0,0]),0xe0452a],
    [tr(new THREE.CylinderGeometry(0.02,0.02,0.75,4),[0.07,0.38,0]),0xe0452a],[tr(new THREE.CylinderGeometry(0.02,0.02,0.75,4),[-0.07,0.38,0]),0xe0452a]]);}
function duckGeo(){return merge([[tr(new THREE.IcosahedronGeometry(0.18,1),[0,0.08,0],[0,0,0],[0.8,0.6,1.3]),0x8a6a4a],[tr(new THREE.IcosahedronGeometry(0.09,1),[0,0.25,0.2]),0x1f6b3a],[tr(new THREE.BoxGeometry(0.05,0.03,0.1),[0,0.23,0.31]),0xf0a020]]);}
function swanGeo(){return merge([[tr(new THREE.IcosahedronGeometry(0.35,1),[0,0.15,0],[0,0,0],[0.8,0.6,1.4]),0xffffff],[tr(new THREE.CylinderGeometry(0.05,0.06,0.6,6),[0,0.52,0.32],[-0.25,0,0]),0xffffff],
    [tr(new THREE.IcosahedronGeometry(0.08,1),[0,0.82,0.42]),0xffffff],[tr(new THREE.BoxGeometry(0.05,0.05,0.14),[0,0.8,0.53]),0xf08a20]]);}
function waterBirds(){const segs=RIV.filter(sg=>RIVW[sg.ri].p[sg.i]>12&&nearestRoad((sg.a[0]+sg.b[0])/2,(sg.a[1]+sg.b[1])/2,700));if(!segs.length)return;
  for(const [geo,n,fam] of [[duckGeo(),32,4],[swanGeo(),8,2]]){const m=new THREE.InstancedMesh(geo,lifeMat(true),n);m.frustumCulled=false;scene.add(m);LIFE.statics.push(m);LIFE.duckMs.push(m);
    for(let k=0;k<n;){const sg=pick(segs),u=Math.random(),v=rnd(-0.55,0.55)*Math.min(RIVW[sg.ri].p[sg.i],RIVW[sg.ri].m[sg.i])*1.6,bx=sg.a[0]+sg.dx*u-sg.tz*v,bz=sg.a[1]+sg.dz*u+sg.tx*v,amp=rnd(8,22),sp=rnd(0.02,0.05),ph=rnd(0,6.28);
      for(let q=0;q<fam&&k<n;q++,k++)LIFE.ducks.push({m,k,wy:RIVW[sg.ri].y[sg.i],bx:bx+rnd(-2.5,2.5)*sg.tz,bz:bz-rnd(-2.5,2.5)*sg.tx,tx:sg.tx,tz:sg.tz,ph:ph+q*0.08,sp,amp,bob:rnd(0,6)});}}}
// Ausflugsboote auf der Donau (fahren rund um die Altstadt hin und her)
function riverBoats(){const r=ULM.river,cum=[0];for(let i=1;i<r.length;i++)cum.push(cum[i-1]+Math.hypot(r[i][0]-r[i-1][0],r[i][1]-r[i-1][1]));
  let mi=0,md=1e9;r.forEach((q,i)=>{const d=Math.hypot(q[0]-ULM.places.muenster[0],q[1]-ULM.places.muenster[1]);if(d<md){md=d;mi=i;}});
  const geo=merge([[tr(new THREE.BoxGeometry(2.8,1.0,10),[0,0.4,0]),0xf2f2f2],[tr(new THREE.BoxGeometry(2.82,0.18,10.02),[0,0.72,0]),0x2e5fa8],[tr(new THREE.BoxGeometry(2.4,1.3,6),[0,1.55,-0.5]),0xeaeaea],
    [tr(new THREE.BoxGeometry(2.44,0.45,5.6),[0,1.65,-0.5]),0x2a3540],[tr(new THREE.BoxGeometry(2.6,0.12,6.4),[0,2.25,-0.5]),0x2e5fa8],[tr(new THREE.ConeGeometry(1.4,2.2,4),[0,0.4,6.0],[Math.PI/2,Math.PI/4,0],[1,1,0.45]),0xf2f2f2]]);
  const s0=Math.max(0,cum[mi]-1500),s1=Math.min(cum[cum.length-1],cum[mi]+1500),mat=lifeMat(true);
  for(let k=0;k<2;k++){const m=new THREE.Mesh(geo,mat);m.castShadow=true;scene.add(m);LIFE.statics.push(m);LIFE.rboats.push({m,s:s0+(s1-s0)*(0.3+0.4*k),dir:k?1:-1,s0,s1,cum,r});}}
function stepRiverBoat(b,dt){b.s+=b.dir*2.2*dt;if(b.s>b.s1){b.s=b.s1;b.dir=-1;}if(b.s<b.s0){b.s=b.s0;b.dir=1;}
  let i=1;while(i<b.cum.length-1&&b.cum[i]<b.s)i++;const a=b.r[i-1],c=b.r[i],u=(b.s-b.cum[i-1])/Math.max(0.01,b.cum[i]-b.cum[i-1]),tx=(c[0]-a[0]),tz=(c[1]-a[1]),l=Math.hypot(tx,tz)||1;
  const off=b.dir*RIVER_HW*0.35,R=RIVW[0],wy=R.y[i-1]+(R.y[i]-R.y[i-1])*u;b.m.position.set(a[0]+tx*u-tz/l*off,wy+0.05,a[1]+tz*u+tx/l*off);b.m.rotation.set(0,Math.atan2(tx*b.dir,tz*b.dir),Math.sin(performance.now()/900+b.s)*0.02);}
// Delfine (Kalea): springen ab und zu in deiner Nähe aus dem Meer
function dolphins(){const geo=merge([[tr(new THREE.IcosahedronGeometry(0.5,1),[0,0,0],[0,0,0],[0.42,0.42,1.6]),0x6f8fa8],[tr(new THREE.IcosahedronGeometry(0.3,1),[0,-0.08,0.1],[0,0,0],[0.5,0.3,1.4]),0xdfe8ee],
    [tr(new THREE.ConeGeometry(0.12,0.35,4),[0,0.3,-0.05],[-0.4,0,0],[0.4,1,1]),0x5f7f98],[tr(new THREE.BoxGeometry(0.7,0.04,0.22),[0,0,-0.85]),0x5f7f98],[tr(new THREE.ConeGeometry(0.08,0.3,6),[0,-0.02,0.9],[Math.PI/2,0,0]),0x6f8fa8]]);
  const mat=lifeMat(true);for(let k=0;k<3;k++){const m=new THREE.Mesh(geo,mat);m.visible=false;scene.add(m);LIFE.dolph.push({m,wait:rnd(4,15),jumps:0,t:0,x:0,z:0,dx:0,dz:1});}}
function stepDolphin(d,dt){const m=d.m;
  if(!d.jumps){m.visible=false;d.wait-=dt;if(d.wait>0||!player)return;
    for(let t=0;t<16;t++){const a=rnd(0,6.28),r=rnd(150,480),x=player.position.x+Math.cos(a)*r,z=player.position.z+Math.sin(a)*r,h=rnd(0,6.28),dx=Math.cos(h),dz=Math.sin(h);
      if(rawHeight(x,z)<-6&&rawHeight(x+dx*20,z+dz*20)<-6){Object.assign(d,{x,z,dx,dz,jumps:2+(Math.random()*2|0),t:0});return;}}
    d.wait=rnd(3,8);return;}
  d.t+=dt/1.3;if(d.t>=1){d.jumps--;d.t=-0.35;d.x+=d.dx*7;d.z+=d.dz*7;if(!d.jumps)d.wait=rnd(8,22);}
  if(d.t<0){m.visible=false;return;}
  const u=d.t,y=0.3-0.7+Math.sin(Math.PI*u)*2.0,slope=Math.cos(Math.PI*u)*Math.PI*2.0/6;
  m.visible=true;m.position.set(d.x+d.dx*(u-0.5)*6,y,d.z+d.dz*(u-0.5)*6);m.rotation.set(-Math.atan(slope),Math.atan2(d.dx,d.dz),0,'YXZ');}
// Parkende Autos in Ulmer Seitenstraßen
function parkedCars(n){const items=[],cols=[0xd8d8d8,0x2b2b2b,0xf4f4f4,0x3a5a8a,0x9a2a2a,0x6a6a6a,0x2f4f3a,0xc9b27a];
  const W=(x,z)=>[tr(new THREE.CylinderGeometry(0.33,0.33,0.25,10),[x,0.33,z],[0,0,Math.PI/2]),0x1a1a1a];
  const geo=merge([[tr(new THREE.BoxGeometry(1.8,0.62,4.3),[0,0.62,0]),0xffffff],[tr(new THREE.BoxGeometry(1.64,0.34,2.24),[0,1.1,-0.2]),0x2a3540],[tr(new THREE.BoxGeometry(1.6,0.12,2.1),[0,1.33,-0.2]),0xffffff],
    [tr(new THREE.BoxGeometry(1.5,0.12,0.05),[0,0.75,2.16]),0xfff3c4],[tr(new THREE.BoxGeometry(1.5,0.12,0.05),[0,0.75,-2.16]),0xc0392b],W(0.82,1.35),W(-0.82,1.35),W(0.82,-1.35),W(-0.82,-1.35)]);
  for(const rd of ULM.vroads||[]){const p=rd.p;
    for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1)continue;const tx=dx/l,tz=dz/l;
      for(let u=0;u<l;u+=6.5){if(Math.random()>0.22)continue;const sd=Math.random()<0.5?-1:1,off=(rd.w||5.5)-1.3,x=a[0]+tx*u-tz*off*sd,z=a[1]+tz*u+tx*off*sd,ry=Math.atan2(tx,tz);
        if(ulmZone(x,z).d<0.45||nearestRoad(x,z,9)||riverDist(x,z).d<RIVER_HW+10||inOsm(x,z))continue;
        items.push({x,z,y:finalHeight(x,z)+0.14,ry:ry+(Math.random()<0.5?Math.PI:0),sx:1,sy:1,sz:1,c:pick(cols)});}}}
  for(let i=items.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[items[i],items[j]]=[items[j],items[i]];}
  LIFE.statics.push(...chunkedInstances(geo,lifeMat(true),items.slice(0,n)));}
function buildLife(){const q=S.quality==='low'?0.6:1;
  buildWalkers(Math.round((IS_ULM?40:16)*q));
  // Zuschauer an Start/Ziel (nicht in Häusern)
  komDecor(Math.round(74/ds)%N,(x,z)=>freeSpot(x,z,5));
  if(IS_ULM){const meadow=(x,z)=>ulmZone(x,z).d<0.05&&slopeY(x,z)>0.9&&riverDist(x,z).d>RIVER_HW+40&&!nearVRoad(x,z,10)&&footFree(x,z,10);
    peopleUlm();herd(cowGeo(),Math.round(36*q),meadow,[0xffffff,0xffffff,0xd8c0a8],5,'kuh');herd(horseGeo(),Math.round(12*q),meadow,[0xffffff,0xc8b8a8,0x7a6a5a,0xf0e0c8],3,'pferd');
    herd(storkGeo(),8,(x,z)=>{const rd=riverDist(x,z).d;return rd>RIVER_HW+30&&rd<RIVER_HW+260&&ulmZone(x,z).d<0.1&&!nearVRoad(x,z,8)&&footFree(x,z,5);},[0xffffff],2,'storch');
    waterBirds();riverBoats();parkedCars(Math.round(320*q));}
  else{beachLife();dolphins();
    // Möwen über der Küste
    const coast=[];for(let i=0;i<N;i+=Math.round(60/ds))for(const sd of [-1,1])for(let o=60;o<=500;o+=40){const [x,z]=lateralPoint(i,sd*o);if(rawHeight(x,z)<0){coast.push([x,z]);break;}}
    if(coast.length)LIFE.statics.push(...birds(8,{col:0xf4f4f4,cnt:[1,3],y:[12,32],r:[25,70],sp:[0.08,0.14],s:0.45,center:()=>pick(coast)}));}
  for(const m of LIFE.statics)m.userData.life=true;applyLifeVis();}
function applyLifeVis(){for(const m of LIFE.statics)m.visible=S.life;for(const o of ONC.list)if(!S.life)o.obj.visible=false;}
function stepLife(dt,t){const run=S.started&&!S.paused?dt:0;stepOncoming(run);stepWalkers(run);if(!S.life)return;
  if(LIFE.ducks.length){const dm=_wo;dm.scale.setScalar(1);
    for(const d of LIFE.ducks){const u=Math.sin(t*d.sp+d.ph)*d.amp,du=Math.cos(t*d.sp+d.ph)||1e-3;
      dm.position.set(d.bx+d.tx*u,d.wy+0.02+0.03*Math.sin(t*1.7+d.bob),d.bz+d.tz*u);dm.rotation.set(0,Math.atan2(d.tx*du,d.tz*du),0,'YXZ');dm.updateMatrix();d.m.setMatrixAt(d.k,dm.matrix);}
    for(const m of LIFE.duckMs)m.instanceMatrix.needsUpdate=true;}
  for(const b of LIFE.rboats)stepRiverBoat(b,dt);
  for(const d of LIFE.dolph)stepDolphin(d,run);}

/* ================= Welt/Route wechseln ohne Neuladen (Bluetooth-Geräte bleiben verbunden) ================= */
let REBUILD=false,SCENE_BASE=null;
function disposeTree(o){o.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.isInstancedMesh&&c.dispose)c.dispose();
  for(const m of c.material?(Array.isArray(c.material)?c.material:[c.material]):[]){
    for(const k in m){const v=m[k];if(v&&v.isTexture)v.dispose();}
    if(m.uniforms)for(const k in m.uniforms){const v=m.uniforms[k]&&m.uniforms[k].value;if(v&&v.isTexture)v.dispose();}m.dispose();}});}
// alles, was beim Bauen einer Welt angelegt wird, wieder zurücksetzen (Lichter und Kamera bleiben)
function clearWorld(){
  for(const o of scene.children.slice()){if(SCENE_BASE.has(o))continue;scene.remove(o);disposeTree(o);}
  HASH.clear();LAPCLIMB=0;MAXH=0;KOM_I=0;RVMAX=null;CLIMBS=[];
  BOTS=[];smoke=[];boats=[];clouds=[];lavaMat=lavaLight=sky=water=player=null;
  CULLS.length=0;GRASS_CHUNKS.length=0;TERR=null;heightTex=null;
  RIV=null;RIVW=null;RIVG=null;CAMOCC.clear();VR=[];VRHASH=new Map();RNAME=null;LANDMARK_FOOT=[];MAPBLD.length=0;OCC.clear();MAPPOLY.length=0;
  LABELS=[];FANS=[];BALLOONS=[];BIRDS=[];MAP.labels=[];MAP.bg=null;
  OSM.data=null;OSM.built=0;OSM.embedded=false;
  ONC.list=[];Object.assign(LIFE,{walk:[],wm:null,ducks:[],duckMs:[],dolph:[],rboats:[],statics:[]});
  for(const p of NET.peers.values())p.obj=null;}
async function buildWorld(){
  buildRoute();if(IS_ULM){ULM=ULM_DATA;await osmLoadCached();riverFit();}buildSmoothGrade();buildSky();buildTerrain();buildWater();buildRoad();if(IS_ULM){buildLandmarks();buildVegetation();}else{buildVegetation();buildLandmarks();}initRiders();decorate();toonify(scene);buildMapBg();applyQuality();
  $('title').innerHTML=IS_ULM?'Kalea Ride <span>Ulm</span>':'Kalea Ride <span>Vulkaninsel</span>';}
// Fahrt auf null stellen (neue Fahrt, Welt- oder Routenwechsel)
function resetRide(){
  if(W.active)stopWorkout();
  Object.assign(S,{dist:0,v:0,elapsed:0,climb:0,lastH:null,legPhase:0,wheel:0,started:false,riding:false,paused:false});
  Object.assign(REC,{s:[],acc:0,start:Date.now(),koms:[],laps:[],ended:false});
  KOM.act=null;KOM.shownT=0;LAP.act=null;$('komBanner').classList.add('hidden');$('komBox').classList.add('hidden');
  placeBotsStart();
  $('hud').classList.add('hidden');$('statsView').classList.add('hidden');$('simBox').classList.add('hidden');
  $('bStart').textContent='Losfahren';$('bStart').onclick=()=>startRide(false);$('bSim').classList.remove('hidden');$('bStats').classList.add('hidden');$('bEnd').classList.add('hidden');}
function newRide(){resetRide();openMenu();}
async function rebuildWorld(world,route,msg){
  if(REBUILD)return;REBUILD=true;
  try{localStorage.setItem('kalea_world',world);if(route)localStorage.setItem('kalea_route_'+world,route);}catch(e){}
  $('loading').textContent=msg||'Welt wird gebaut …';$('loading').classList.remove('hidden');
  await new Promise(r=>setTimeout(r,60));
  // angefangene Fahrt nicht verlieren: in „Frühere Fahrten“ übernehmen
  if(!REC.ended&&REC.s.length>=60){const sum=rideSummary();if(sum)saveRideHistory(sum);}
  resetRide();
  WORLD=world;IS_ULM=world==='ulm';ROUTE_ID=route||(()=>{try{return localStorage.getItem('kalea_route_'+world)||'';}catch(e){return '';}})();
  try{clearWorld();await buildWorld();}
  catch(e){console.error(e);$('loading').textContent='Fehler beim Bauen der Welt – Seite wird neu geladen …';setTimeout(()=>location.reload(),1500);return;}
  applyBotVis();
  buildRouteMenu();wireOsm();$('komTable').innerHTML=komTable();updateNetUi();
  if($('mapDet').open)requestAnimationFrame(()=>drawMap($('bigMap'),{mode:'route',big:true}));
  REBUILD=false;PERF.t0=0;PERF.frames=0;
  $('loading').classList.add('hidden');openMenu();
  const on=[T.dev&&'Trainer',Z.pads.some(p=>p.connected)&&'Click',HR.dev&&'Pulsgurt',CS.dev&&'Trittfrequenz'].filter(Boolean);
  if(on.length)toast('🔗 Weiter verbunden: '+on.join(', '));}

// Geräte-Fenster beim Start: derselbe Geräte-Abschnitt wie im Menü, nur vorübergehend in das Fenster verschoben
function openDevices(){$('devSlot').appendChild($('devSec'));$('setup').classList.add('hidden');$('devDlg').classList.remove('hidden');}
function closeDevices(){$('devHome').after($('devSec'));$('devDlg').classList.add('hidden');openMenu();}

/* ================= Start ================= */
function decorate(){
  toonClouds(IS_ULM?30:36,IS_ULM?850:750,IS_ULM?1250:1150);
  bunting(26);bunting(70);for(const c of CLIMBS)bunting(Math.max(10,c.end-40));
  birds(5);
  if(IS_ULM){balloons(5,0,-600,2600,520);
    flowers(S.quality==='high'?2600:S.quality==='medium'?1200:500,(x,z)=>ulmZone(x,z).d<0.3&&riverDist(x,z).d>RIVER_HW+12&&!nearVRoad(x,z,6)&&footFree(x,z,2));
    sheep(90,(x,z)=>ulmZone(x,z).d<0.05&&slopeY(x,z)>0.9&&riverDist(x,z).d>RIVER_HW+40&&!nearVRoad(x,z,10)&&footFree(x,z,10)&&!nearOsm(x,z,8));}
  else{balloons(3,0,0,2000,420);
    flowers(S.quality==='high'?2200:S.quality==='medium'?1000:400,(x,z)=>{const h=rawHeight(x,z);return h>6&&Math.hypot(x-VOLC.x,z-VOLC.z)>380;});
    sheep(50,(x,z)=>{const h=rawHeight(x,z);return h>12&&h<60&&slopeY(x,z)>0.92&&Math.hypot(x-VOLC.x,z-VOLC.z)>700;});}
  buildLife();
}
async function boot(){
  loadSettings();CHUNK=S.quality==='low'?900:500;initScene();SCENE_BASE=new Set(scene.children);await buildWorld();wireUi();
  $('loading').classList.add('hidden');openDevices();
  if(OSM.built)toast('🏠 '+OSM.built.toLocaleString('de-DE')+' echte Häuser aus OpenStreetMap sind aktiv');
  requestAnimationFrame(frame);
}
setTimeout(boot,30);
