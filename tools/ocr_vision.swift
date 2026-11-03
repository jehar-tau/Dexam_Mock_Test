import Foundation
import Vision
import AppKit

// Small Apple Vision OCR helper for scanned exam PDFs.
// Usage: ocr_vision <image-path>
// Prints one JSON object per recognized line. The Python importer reconstructs
// a column-aware reading order from the normalized bounding boxes.

let args = CommandLine.arguments
guard args.count > 1 else {
    fputs("usage: ocr_vision <image>\n", stderr)
    exit(1)
}

let url = URL(fileURLWithPath: args[1])
guard let image = NSImage(contentsOf: url),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("cannot read image: \(args[1])\n", stderr)
    exit(2)
}

let markerPattern = try! NSRegularExpression(
    pattern: "^\\s*(?:Q(?:uestion)?(?:\\s*(?:no|number)\\b)?\\s*[.:\\-]?\\s*)?\\d{1,3}\\s*[.):\\-]?", options: [.caseInsensitive])

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
    for observation in request.results ?? [] {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let box = observation.boundingBox
        var payload: [String: Any] = [
            "text": candidate.string,
            "x": box.origin.x,
            "y": box.origin.y,
            "w": box.size.width,
            "h": box.size.height
        ]
        // The exact box of a leading question number ("Q.06", "Q7)", "28."), so crops can blank
        // it out and questions can be mixed into new papers without their original numbers.
        let text = candidate.string
        if let match = markerPattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let range = Range(match.range, in: text),
           let marker = try? candidate.boundingBox(for: range) {
            let rect = marker.boundingBox
            payload["marker"] = ["x": rect.origin.x, "y": rect.origin.y, "w": rect.size.width, "h": rect.size.height]
        }
        if let data = try? JSONSerialization.data(withJSONObject: payload),
           let line = String(data: data, encoding: .utf8) {
            print(line)
        }
    }
} catch {
    fputs("OCR failed: \(error)\n", stderr)
    exit(3)
}
