
# Detective Conan OST Manga Reader  

As a long-time Detective Conan enthusiast, I've always appreciated its iconic Original Soundtrack (OST). This project was conceived from the idea of enhancing the manga reading experience by integrating these memorable tracks at appropriate moments.

The is a web application designed for Detective Conan manga, featuring dynamic soundtrack playback. As you navigate through chapters, the application plays OST selections intended to match the mood of each page.

## Core Features 

* **Dynamic OST Playback:** Read Detective Conan chapters accompanied by music selected to reflect the current page's atmosphere.
* **AI-Powered Mood Classification:** Google's Gemini AI analyzes manga pages to determine their dominant mood (e.g., tension, revelation, comedy), which informs the soundtrack mapping.
* **Chapter Management:** Add new manga chapters for processing. The system handles image downloading, classification, and makes them available in the reader.
* **Mood Editor:** While the AI provides initial classifications, users can review and adjust the mood assigned to each page, allowing for fine-tuning of the OST experience.
* **Reading Interface:** A clean, user-friendly interface for manga reading, including page counters and chapter navigation.

## Technology Stack



* **Frontend:** [Next.js](https://nextjs.org/) with [React](https://reactjs.org/) and [Tailwind CSS](https://tailwindcss.com/) for the user interface.
* **Backend & Database:** [Supabase](https://supabase.io/) (using PostgreSQL) manages chapter data and classifications.
* **Content Delivery:** [Google Cloud Storage (GCS)](https://cloud.google.com/storage) hosts manga images and audio tracks.
* **AI Classification:** [Google Gemini](https://deepmind.google/technologies/gemini/) provides the image mood classification.
* **Background Processing:** [Google Cloud Functions](https://cloud.google.com/functions) and [Cloud Tasks](https://cloud.google.com/tasks) handle chapter processing and other intensive operations in the background.
* **Hosting & Deployment:** The application is containerized using [Docker](https://www.docker.com/) and deployed on [Google Cloud Run](https://cloud.google.com/run).
* **CI/CD:** A [Google Cloud Build](https://cloud.google.com/build) pipeline automates builds and deployments.


I DO NOT OWN THE RIGHTS TO THE MANGA OR THE DETECTIVE CONAN SOUNDTRACK
