"""Refresh the published SBU/ETA GTFS snapshot. No credentials required."""
import csv,io,json,urllib.request,zipfile
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
url='https://s3.amazonaws.com/etatransit.gtfs/stonybrook.etaspot.net/gtfs.zip'
z=zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url,timeout=30).read()))
def rows(f):return list(csv.DictReader(io.TextIOWrapper(z.open(f),encoding='utf-8-sig')))
def seconds(t):
 if not t:return None
 h,m,s=map(int,t.split(':'));return h*3600+m*60+s
trips={r['trip_id']:{'route':r['route_id'],'headsign':r['trip_headsign'],'shape':r['shape_id'],'stops':[]} for r in rows('trips.txt')}
stop_routes=defaultdict(set)
for r in rows('stop_times.txt'):
 t=trips[r['trip_id']];t['stops'].append([int(r['stop_sequence']),r['stop_id'],seconds(r['arrival_time'] or r['departure_time'])]);stop_routes[r['stop_id']].add(t['route'])
for t in trips.values():t['stops'].sort()
shapes=defaultdict(list)
for r in rows('shapes.txt'):shapes[r['shape_id']].append([int(r['shape_pt_sequence']),round(float(r['shape_pt_lat']),6),round(float(r['shape_pt_lon']),6)])
data={'source':url,'fetchedAt':datetime.now(timezone.utc).isoformat(),'feed':rows('feed_info.txt')[0],
 'routes':[{'id':r['route_id'],'short':r['route_short_name'],'name':r['route_long_name'],'color':'#'+(r['route_color'] or '416a55')} for r in rows('routes.txt')],
 'stops':[{'id':r['stop_id'],'name':r['stop_name'],'lat':float(r['stop_lat']),'lon':float(r['stop_lon']),'routes':sorted(stop_routes[r['stop_id']])} for r in rows('stops.txt')],
 'trips':trips,'shapes':{k:[[x[1],x[2]] for x in sorted(v)] for k,v in shapes.items()}}
Path('public/transit-data.json').write_text(json.dumps(data,separators=(',',':')))
print('Transit snapshot:',len(data['routes']),'routes,',len(data['stops']),'stops')
