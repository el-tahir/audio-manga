import requests
import os
import sys
import argparse
import zipfile # Added for potential future zipping within script if needed

def download_chapter(series_slug, chapter_number, output_dir):
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        # Fetch series JSON
        series_url = f"https://cubari.moe/read/api/weebcentral/series/{series_slug}/"
        print(f"Fetching series data from: {series_url}")
        response = requests.get(series_url)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        series_data = response.json()
        print("Successfully fetched series data.")

        # Find the chapter
        chapter_data = series_data['chapters'].get(str(chapter_number))
        if not chapter_data:
            print(f"Chapter {chapter_number} not found for series {series_slug}", file=sys.stderr)
            return None # Indicate failure

        group_url = chapter_data['groups'].get('1') # Assuming group 1 is WeebCentral
        if not group_url:
            print(f"Group '1' (WeebCentral) not found for chapter {chapter_number}", file=sys.stderr)
            # Try finding any group URL
            if chapter_data['groups']:
                 group_key = list(chapter_data['groups'].keys())[0]
                 group_url = chapter_data['groups'][group_key]
                 print(f"Using first available group: {group_key}")
            else:
                print(f"No groups found for chapter {chapter_number}", file=sys.stderr)
                return None # Indicate failure

        # Fetch chapter details
        chapter_details_url = f"https://cubari.moe{group_url}"
        print(f"Fetching chapter details from: {chapter_details_url}")
        response = requests.get(chapter_details_url)
        response.raise_for_status()
        chapter_details = response.json()
        print("Successfully fetched chapter details.")

        # Get image URLs
        if isinstance(chapter_details, list):
            image_urls = chapter_details
        elif isinstance(chapter_details, dict):
            image_urls = chapter_details.get('pages', [])
        else:
            print(f"Unexpected chapter details type: {type(chapter_details)}", file=sys.stderr)
            return None # Indicate failure

        total_pages = len(image_urls)
        if total_pages == 0:
            print(f"No pages found for chapter {chapter_number}")
            # Return None, indicates nothing was downloaded.
            return None

        print(f"Found {total_pages} pages for chapter {chapter_number}.")

        # Create specific chapter directory within the output directory
        safe_slug = "".join(c for c in series_slug if c.isalnum() or c in ('_', '-')).rstrip()
        chapter_specific_dir = os.path.join(output_dir, f"{safe_slug}_Chapter_{chapter_number}")
        os.makedirs(chapter_specific_dir, exist_ok=True)
        print(f"Output directory: {chapter_specific_dir}")


        downloaded_files = []
        # Download each page
        for page, proxy_url in enumerate(image_urls, start=1):
            print(f"Downloading page {page}/{total_pages} from {proxy_url}...")
            try:
                image_response = requests.get(proxy_url, timeout=30) # Added timeout
                image_response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

                # Try to infer extension, default to png
                content_type = image_response.headers.get('content-type')
                extension = 'png' # default
                if content_type:
                    if 'jpeg' in content_type or 'jpg' in content_type:
                        extension = 'jpg'
                    elif 'png' in content_type:
                        extension = 'png'
                    elif 'webp' in content_type:
                        extension = 'webp'
                    elif 'gif' in content_type:
                         extension = 'gif'

                file_path = os.path.join(chapter_specific_dir, f"page_{page:03d}.{extension}")
                with open(file_path, 'wb') as f:
                    f.write(image_response.content)
                print(f"Saved page {page} to {file_path}")
                downloaded_files.append(file_path)

            except requests.Timeout:
                print(f"Timeout downloading page {page}", file=sys.stderr)
            except requests.RequestException as e:
                print(f"Failed to download page {page}: {e}", file=sys.stderr)

        download_count = len(downloaded_files)
        if download_count > 0:
            print(f"Successfully downloaded {download_count}/{total_pages} pages for chapter {chapter_number} to {chapter_specific_dir}")
            return chapter_specific_dir # Return the path even if partial
        else:
            print(f"Failed to download any pages for chapter {chapter_number}.", file=sys.stderr)
            # Clean up the empty directory if nothing was downloaded
            try:
                os.rmdir(chapter_specific_dir)
                print(f"Removed empty directory: {chapter_specific_dir}")
            except OSError as rm_err:
                 print(f"Could not remove directory {chapter_specific_dir}: {rm_err}", file=sys.stderr)
            return None

    except requests.RequestException as e:
        print(f"Network error occurred: {e}", file=sys.stderr)
        return None
    except KeyError as e:
        print(f"Data structure error: Missing key {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download manga chapter pages from Cubari.')
    parser.add_argument('series_slug', help='The slug for the series on Cubari.')
    parser.add_argument('chapter_number', type=str, help='The chapter number to download.') # Allow string like 1128.5
    parser.add_argument('--output-dir', default='.', help='The base directory to save the chapter folder in.')

    args = parser.parse_args()

    # Call the function
    result_path = download_chapter(args.series_slug, args.chapter_number, args.output_dir)

    if result_path:
        print(f"Script finished successfully. Chapter downloaded to: {result_path}")
        # Print the path to stdout prefixed for easy parsing by the calling process
        print(f"DOWNLOAD_PATH:{result_path}")
        sys.exit(0) # Exit with success code
    else:
        print("Script finished with errors.", file=sys.stderr)
        sys.exit(1) # Exit with failure code 