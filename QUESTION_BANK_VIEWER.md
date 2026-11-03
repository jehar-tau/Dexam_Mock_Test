# Question Bank Viewer

An interactive web UI to browse, review, and manage the machine-readable question bank containing 4,521+ questions from UCEED, NIFT, NID, and CEED exams.

## Features

- **Browse Questions**: View all 4,521 questions from the machine-readable question bank
- **Filter & Search**: Filter by exam, question type, answer status, or search by text/ID
- **Detail View**: View complete question details including:
  - Question text and number
  - Question figures/images
  - Multiple choice or numerical answer options
  - Official answer keys
  - Answer status (official-key, pending, independently-solved)
- **Quality Review**: 
  - Mark questions for detailed review
  - Flag issues found in questions
  - Add notes for each question
  - Save review state for later reference
- **Bank Comparison**: Compare questions with other question banks (generic bank, etc.)
- **Pagination**: Browse 50 questions per page with easy navigation

## Quick Start

### Start the Server

```bash
cd /Users/snehalkumarshinde/Documents/Default\ Project/Dexam_Mock_Test
node server/question-bank-viewer.js
```

The server will:
- Load the machine-readable question bank (4,521 questions)
- Load the generic question bank (566 questions) for comparison
- Start on `http://localhost:3000`

### Open the UI

Open your browser and navigate to:
```
http://localhost:3000
```

## User Guide

### Dashboard
- View summary statistics: Total questions count by exam (UCEED, NIFT, NID, CEED)
- See question type distribution (MCQ, NAT, MSQ, DESCRIPTIVE)
- Check answer status breakdown (official-key, pending, independently-solved)

### Filtering
1. **By Exam**: Select from UCEED, NIFT, NID, or CEED
2. **By Type**: Filter by MCQ, NAT, MSQ, or DESCRIPTIVE questions
3. **By Status**: Filter by official-key, pending, or independently-solved
4. **Search**: Search for questions by text content, question ID, or number

### Viewing Questions
1. Click on any question in the list to view full details
2. See question text, figure, options, and answer key
3. Review comparison status with other question banks

### Marking for Review
1. Click "✓ Mark for Review" button or check the checkbox
2. Click "⚠ Flag Issue" to flag problematic questions
3. Add notes in the textarea for detailed feedback
4. Click "Save Notes" to persist your review

### Navigation
- Use pagination controls at bottom of questions list
- Navigate to specific page by clicking page number
- Scroll through question list to see more details

## API Endpoints

The server provides these API endpoints:

- `GET /api/summary` - Get summary statistics of all questions
- `GET /api/questions?exam=X&type=Y&status=Z&search=Q&page=P&limit=L` - Get filtered questions
- `GET /api/questions/:id` - Get a specific question with review state
- `POST /api/questions/:id/mark` - Save review state (marked, flagged, notes)
- `GET /api/compare/:id` - Compare question with other banks

## Data Structure

### Machine-Readable Question Format
```json
{
  "id": "exam-year-qN",
  "exam": "UCEED|NIFT|NID|CEED",
  "paper_id": "exam-year",
  "question_no": "N",
  "type": "MCQ|NAT|MSQ|DESCRIPTIVE",
  "question_text": "Question text...",
  "options": ["Option A", "Option B", ...],
  "figure_image": "path/to/image.png",
  "answer_key": "Answer",
  "answer_status": "official-key|pending|independently-solved",
  "source_paper": "Source information"
}
```

## Features in Detail

### Quality Assurance
- Review OCR accuracy of question text
- Check option parsing for multiple choice questions
- Verify figure image availability and correctness
- Validate answer keys against official sources

### Assessment Tools
- Compare questions across different sources
- Identify gaps in question coverage
- Track questions needing improvement
- Mark questions for further review

## Architecture

```
server/question-bank-viewer.js  - Node.js HTTP server (no dependencies)
public/index.html               - Interactive web UI (vanilla JS/HTML/CSS)
dexam-bank-machine-readable.json - Machine-readable question bank
server/data/                    - Question figures and other data
```

## Requirements

- Node.js v14+ (for running the server)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- The machine-readable question bank JSON file

## Troubleshooting

### Images Not Loading
- Check that question figure paths are correct in the JSON
- Ensure the `server/data/media/` directory contains the image files
- Image paths should be relative to the server root

### Questions Not Loading
- Verify the machine-readable question bank JSON file exists
- Check server console for error messages
- Ensure the JSON file is valid

### Port Already in Use
- Change the PORT variable in `server/question-bank-viewer.js`
- Or use a different port: `PORT=3001 node server/question-bank-viewer.js`

## Future Enhancements

- [ ] Export questions as PDF/Excel
- [ ] Bulk review operations
- [ ] Advanced search and analytics
- [ ] Question difficulty assessment
- [ ] Topic/subject categorization
- [ ] Drag-and-drop image uploads
- [ ] Multi-user collaboration features
- [ ] Review history and audit trail

## License

Part of the Dexam Mock Test project.
