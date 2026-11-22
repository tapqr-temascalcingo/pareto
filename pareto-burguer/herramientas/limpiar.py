import openpyxl, json, re, sys, unicodedata
src, out = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src, data_only=True).active
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if any(v not in (None, '') for v in r)]

def s(v): return re.sub(r'\s+', ' ', str(v or '')).strip()
def low(v): return unicodedata.normalize('NFKD', s(v).lower()).encode('ascii','ignore').decode()
def multi(v, fix=None):
    parts = [p.strip() for p in s(v).split(', ') if p.strip()]
    return [fix.get(p, p) if fix else p for p in parts]

def edad(v):
    m = re.search(r'\d+', s(v)); n = int(m.group()) if m else None
    return n
def rango(n):
    if n is None: return 'Sin dato'
    if n <= 19: return '15 a 19 años'
    if n <= 22: return '20 a 22 años'
    if n <= 25: return '23 a 25 años'
    if n <= 30: return '26 a 30 años'
    return '31 años o más'
def genero(v):
    l = low(v)
    if l.startswith(('fem','muj','f')): return 'Mujer'
    if l.startswith(('mas','hom','m')): return 'Hombre'
    return 'Sin dato'
def ocup(v):
    l = low(v)
    if 'estudi' in l: return 'Estudiante'
    if 'docente' in l: return 'Docente'
    if 'ninguna' in l: return 'Ninguna'
    return 'Trabaja'
def estudios(v):
    l = low(v)
    if 'maestr' in l: return 'Maestría'
    if 'secundaria' in l: return 'Secundaria'
    if any(k in l for k in ('prepa','bachiller','medio superior')): return 'Preparatoria'
    return 'Licenciatura / Universidad'
def residencia(v):
    l = low(v)
    if 'temascalcingo' in l: return 'Temascalcingo'
    if 'el oro' in l: return 'El Oro'
    if re.fullmatch(r'[\d.]*', l): return 'Sin dato válido'
    return 'Otro lugar'

FIX = {'Miercoles':'Miércoles', 'De a 10 a 20 minutos':'De 10 a 20 minutos',
       'No experimente retrasos':'No experimenté retrasos'}
ESPERA_ORDEN = ['Menos de 10 minutos','De 10 a 20 minutos','De 21 a 30 minutos','Más de 30 minutos']
FREC_ORDEN = ['Nunca','Rara vez','Algunas veces','Casi siempre','Siempre']

regs = []
for i, r in enumerate(rows, 1):
    causas = multi(r[6])
    esp = [e for e in multi(r[12], FIX)]
    esp_r = [e for e in esp if e in ESPERA_ORDEN]
    frec = multi(r[11])
    cal = s(r[13]); calnum = int(cal.split(' ')[0]) if cal[:1].isdigit() else None
    regs.append({
        'id': i,
        'fecha': r[0].isoformat(timespec='minutes') if hasattr(r[0], 'isoformat') else s(r[0]),
        'edad': edad(r[1]), 'rangoEdad': rango(edad(r[1])),
        'genero': genero(r[2]), 'ocupacion': ocup(r[3]),
        'residencia': residencia(r[4]), 'estudios': estudios(r[5]),
        'causas': causas,                      # tal como se marcaron (orden del formulario)
        'dias': multi(r[7], FIX), 'horarios': multi(r[8], FIX),
        'etapas': multi(r[9], FIX), 'mejoras': multi(r[10], FIX),
        # si marcó dos opciones en una pregunta de respuesta única, se toma la más desfavorable
        'frecuencia': max(frec, key=FREC_ORDEN.index) if frec else 'Sin dato',
        'espera': max(esp_r, key=ESPERA_ORDEN.index) if esp_r else (esp[0] if esp else 'Sin dato'),
        'calificacion': cal, 'calNum': calnum,
        'orig': {'edad': s(r[1]), 'genero': s(r[2]), 'ocupacion': s(r[3]), 'residencia': s(r[4]), 'estudios': s(r[5])},
    })
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Generado automáticamente desde "Restaurante Burguer.xlsx" (encuesta cerrada).\n')
    f.write('// Cada objeto es una respuesta. Columnas de texto libre ya normalizadas; el valor original va en "orig".\n')
    f.write('window.RESPUESTAS = ' + json.dumps(regs, ensure_ascii=False, indent=1) + ';\n')
print(len(regs))
from collections import Counter
for k in ('rangoEdad','genero','ocupacion','residencia','estudios','frecuencia','espera','calificacion'):
    print(k, Counter(x[k] for x in regs))
