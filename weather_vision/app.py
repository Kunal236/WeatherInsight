from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import requests
import os

app = Flask(__name__)
# SQLite database inside the app directory
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'weather.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class SavedCity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude
        }

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/weather')
def get_weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if not lat or not lon:
        return jsonify({'error': 'Latitude and longitude are required'}), 400
    
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/geocode')
def geocode():
    city = request.args.get('city')
    if not city:
        return jsonify({'error': 'City is required'}), 400
    
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if 'results' in data and len(data['results']) > 0:
            result = data['results'][0]
            return jsonify({
                'name': result.get('name'),
                'latitude': result.get('latitude'),
                'longitude': result.get('longitude'),
                'country': result.get('country', '')
            })
        else:
            return jsonify({'error': 'City not found'}), 404
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/favorites', methods=['GET', 'POST', 'DELETE'])
def handle_favorites():
    if request.method == 'GET':
        cities = SavedCity.query.all()
        return jsonify([city.to_dict() for city in cities])
    
    elif request.method == 'POST':
        data = request.json
        name = data.get('name')
        lat = data.get('latitude')
        lon = data.get('longitude')
        
        if not name or lat is None or lon is None:
            return jsonify({'error': 'Missing data'}), 400
            
        existing = SavedCity.query.filter_by(name=name).first()
        if existing:
            return jsonify({'message': 'City already saved', 'city': existing.to_dict()}), 200
            
        new_city = SavedCity(name=name, latitude=lat, longitude=lon)
        db.session.add(new_city)
        db.session.commit()
        return jsonify({'message': 'City saved successfully', 'city': new_city.to_dict()}), 201
        
    elif request.method == 'DELETE':
        city_id = request.args.get('id')
        if not city_id:
            return jsonify({'error': 'City ID is required'}), 400
            
        city = SavedCity.query.get(city_id)
        if city:
            db.session.delete(city)
            db.session.commit()
            return jsonify({'message': 'City removed successfully'}), 200
        return jsonify({'error': 'City not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=8000)
