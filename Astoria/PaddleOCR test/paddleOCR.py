import cv2
from paddleocr import PaddleOCR, draw_ocr
from PIL import Image
from pathlib import Path

def main():
    # Define directories for input and output images
    input_dir = Path("input_images")    # Change this folder as needed
    output_dir = Path("output_images")
    output_dir.mkdir(exist_ok=True)

    # Initialize PaddleOCR with angle classification enabled.
    ocr = PaddleOCR(use_angle_cls=True, lang='en')
    
    # Supported image extensions
    supported_exts = {'.png', '.webp', '.jpg', '.jpeg'}
    image_paths = [p for p in input_dir.iterdir() if p.suffix.lower() in supported_exts]
    
    if not image_paths:
        print(f"No supported images found in {input_dir}.")
        return

    for image_path in image_paths:
        print(f"\nProcessing: {image_path.name}")
        
        # Read the image
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"Could not load image: {image_path}")
            continue
        
        # Run OCR on the image
        result = ocr.ocr(image, cls=True)
        if not result or len(result) == 0:
            print(f"No text detected in image: {image_path.name}")
            # Optionally, save the original image
            cv2.imwrite(str(output_dir / image_path.name), image)
            continue

        # Print OCR results
        print("OCR Results:")
        for detection in result:
            print(detection)
        
        # Draw bounding boxes and text on the image.
        # Replace 'path/to/font.ttf' with the path to a valid TTF font file if needed.
        try:
            image_with_boxes = draw_ocr(image, result, font_path='path/to/font.ttf')
        except Exception as e:
            print(f"Error drawing OCR results on {image_path.name}: {e}")
            continue

        # Save the annotated image
        output_path = output_dir / image_path.name
        image_with_boxes.save(str(output_path))
        print(f"Output image saved to: {output_path}")

if __name__ == "__main__":
    main()
