from flask import Flask, request, jsonify
import opennsfw2 as n2
import os
import logging

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # Limit file size to 10MB

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Route for checking NSFW images
@app.route('/check_nsfw', methods=['POST'])
def check_nsfw():
    if 'image' not in request.files:
        logging.error("No image part in request")
        return jsonify({"error": "No image part"}), 400
    image_file = request.files['image']
    if image_file.filename == '':
        logging.error("No selected image")
        return jsonify({"error": "No selected image"}), 400
    
    temp_path = os.path.join('temp', image_file.filename)
    try:
        image_file.save(temp_path)
        logging.info(f"Image saved to {temp_path}")
        
        check = round(n2.predict_image(temp_path))
        result = 1 if check > 0 else 0
        logging.info(f"NSFW check result: {result}")
        
    except Exception as e:
        logging.error(f"Error processing image: {e}")
        result = 0
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            logging.info(f"Temporary file {temp_path} removed")
    
    return jsonify({"nsfw": result})

# Run the Flask application
if __name__ == '__main__':
    if not os.path.exists('temp'):
        os.makedirs('temp')
    app.run(host='0.0.0.0', port=5000, debug=True)

