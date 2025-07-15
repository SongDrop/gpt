import sys
import subprocess
import os
import json
import re
from youtube_transcript_api import YouTubeTranscriptApi
import requests
from openai import OpenAI
import multiprocessing
import time
import uuid

# Load OpenAI API key from file
def load_api_key():
    try:
        with open("openaikey.txt", "r") as file:
            return file.read().strip()
    except FileNotFoundError:
        print("Error: openaikey.txt not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading API key: {e}")
        sys.exit(1)

# Load OpenAI prompt content from file
def load_prompt():
    try:
        with open("openaiprompt.txt", "r") as file:
            return file.read()
    except FileNotFoundError:
        print("Error: openaiprompt.txt not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading prompt: {e}")
        sys.exit(1)

# Load OpenAI tags content from file
def load_tags():
    try:
        with open("openaitags.txt", "r") as file:
            return file.read()
    except FileNotFoundError:
        print("Error: openaitags.txt not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading prompt: {e}")
        sys.exit(1)


# Check if a tool is installed
def check_tool_installed(tool_name):
    try:
        subprocess.run([tool_name, '--version'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except subprocess.CalledProcessError:
        print(f"Error: {tool_name} is not installed.")
        sys.exit(1)

# Check if yt-dlp and ffmpeg are installed
def check_ffmpeg_installed():
    # Add the ffmpeg path to the environment within Python
    ffmpeg_path = os.path.join(os.getcwd(), "myenv", "ffmpeg", "bin")
    os.environ["PATH"] = ffmpeg_path + ":" + os.environ["PATH"]
    
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        print("ffmpeg is installed and available.")
    except subprocess.CalledProcessError:
        print("Error: ffmpeg is not installed or cannot be found.")
        sys.exit(1)

# Check if yt-dlp is installed
check_tool_installed("yt-dlp")
check_ffmpeg_installed()  # Ensures ffmpeg is available


########################################
########################################
# Initialize OpenAI client
api_key = load_api_key()
openai_client = OpenAI(api_key=api_key)

#

#download video from Youtube and merge if needed, custom title can be added
def download_video(url, output_directory, mergeOutput=True, custom_title=None):
    try:
        # Determine the title to use: either the custom title or the video title
        title_to_use = custom_title if custom_title else "%(title)s"

        if mergeOutput:
            # Command to download and automatically merge the video and audio
            command = f'yt-dlp "{url}" -f "bestvideo+bestaudio" --merge-output-format mp4 -o "{output_directory}/{title_to_use}.%(ext)s" --postprocessor-args "-c:v libx264 -c:a aac -strict experimental"'
        else:
            # Command to download video and audio separately without NO merging
            command = f'yt-dlp "{url}" -f "bestvideo[ext=mp4][vcodec!^=av0][vcodec!^=av1]+bestaudio[ext=m4a]" -o "{output_directory}/{title_to_use}.%(ext)s"'

        # Run the download command
        subprocess.run(command, shell=True, check=True)

        # If merging is enabled, check if video and audio files are separate and merge them
        if not mergeOutput:
            video_file = None
            audio_file = None

            # Loop through the files in the output directory to find the separate video and audio files
            for file in os.listdir(output_directory):
                if file.endswith(".mp4"):
                    video_file = os.path.join(output_directory, file)
                if file.endswith(".m4a"):
                    audio_file = os.path.join(output_directory, file)

            if video_file and audio_file:
                # Use ffmpeg to merge the video and audio into a single MP4 file
                merged_file = os.path.join(output_directory, f"{os.path.splitext(os.path.basename(video_file))[0]}.mp4")
                merge_command = f"ffmpeg -i \"{video_file}\" -i \"{audio_file}\" -c:v copy -c:a aac -strict experimental \"{merged_file}\""
                subprocess.run(merge_command, shell=True, check=True)

                # Remove the original separate video and audio files after merging (optional)
                os.remove(video_file)
                os.remove(audio_file)

                print(f"Video and audio merged successfully: {merged_file}")
            else:
                print("Error: Video or audio file not found to merge.")
        else:
            print("Video and audio were already merged successfully during download.")

    except subprocess.CalledProcessError as e:
        print(f'Error: Failed to download or merge video/audio. {e}')

def extract_video_id(url):
    regex = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|.+\?v=)?|youtu\.be\/)([^&\n?#]+)'
    match = re.match(regex, url)
    return match.group(1) if match else None

def get_transcript(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return None

def save_transcript_as_json(transcript, output_file):
    try:
        with open(output_file, 'w') as f:
            json.dump(transcript, f, indent=4)
    except Exception as e:
        print(f"Error saving transcript to JSON: {e}")

#Get video title
def get_video_title(url):
    oembed_url = f'https://www.youtube.com/oembed?url={url}&format=json'
    try:
        response = requests.get(oembed_url)
        response.raise_for_status()
        data = response.json()
        return data['title']
    except requests.RequestException as e:
        print(f"Error fetching video title: {e}")
        return None

#Summarise transcript text with openai
def summarize_text(text):
    prompt_content = load_prompt()
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": prompt_content
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            temperature=0,
            max_tokens=2048
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error summarizing text: {e}")
        return None
    
# Generate tags
def generate_tags(text, title=None):
    """
    Generate relevant tags for the video.
    Optionally use the title as part of the text, but filter it first to remove excess details.
    """
    # Clean the title if it's provided
    if title:
        title = clean_title_for_tags(title)
        text = f"{title}\n\n{text}"  # Include cleaned title with transcript for tag generation
    
    prompt_content = load_tags()
    prompt = (
        "Extract relevant tags from the following content:\n\n"
        f"{text}\n\n"
        "Tags should be concise, unique, and cover the main topics and themes.\n"
        "Avoid duplicates or overly generic terms.\n"
        f"Example tags from similar content include: {prompt_content}"
    )
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=2048
        )
        
        # Process response to remove duplicates and clean tags
        raw_tags = response.choices[0].message.content.strip().split("\n")
        unique_tags = set(tag.strip() for tag in raw_tags if tag.strip())  # Remove duplicates and empty tags
        
        # Clean and optimize tags
        cleaned_tags = clean_tags(sorted(unique_tags))  # Clean and sort tags
        
        # Return tags as a single comma-separated string
        return ", ".join(cleaned_tags)  # Join the tags into a single string
    except Exception as e:
        print(f"Error generating tags: {e}")
        return None

# Clean title for tags
def clean_title_for_tags(title):
    """
    Clean and shorten the video title to remove unnecessary or common phrases.
    This can include things like 'Watch now', 'Official', 'Full video', etc.
    """
    # List of common unwanted keywords/phrases to remove
    unwanted_phrases = [
        "Official", "Full", "HD", "Trailer", "Preview", "Watch now", "Live", "Episode", "Vlog", "Music Video"
    ] 
    
    # Lowercase and clean unwanted phrases from the title
    cleaned_title = title.lower()
    for phrase in unwanted_phrases:
        cleaned_title = cleaned_title.replace(phrase.lower(), "")
    
    # Optionally truncate if title is too long
    cleaned_title = " ".join(cleaned_title.split()[:15])  # Keeping first 15 words
    
    return cleaned_title.strip()

# Clean tags
def clean_tags(tags):
    """
    Cleans and optimizes a list of tags:
    - Removes duplicates
    - Eliminates overly generic or repetitive phrases
    - Shortens excessively long lists
    """
    # Deduplicate tags by converting to a set
    unique_tags = list(set(tags))
    
    # Filter out generic words and redundant phrases
    filtered_tags = []
    seen_words = set()
    for tag in unique_tags:
        # Simplify tag by splitting into words and avoiding repeats
        words = tag.lower().split()
        simplified_tag = " ".join(word for word in words if word not in seen_words)
        seen_words.update(words)
        filtered_tags.append(simplified_tag.strip())
    
    # Deduplicate again to remove any repeated tags from the final list
    final_tags = list(set(filtered_tags))  # Remove duplicates after filtering
    
    # Limit the number of tags to a reasonable count (e.g., max 20 tags)
    max_tags = 20
    return sorted(final_tags)[:max_tags]  # Return the first 20 tags (or fewer if necessary)
  
def download_youtube_thumbnail(video_id, output_directory):
    """
    Downloads the YouTube thumbnail image for the given video ID.
    Saves it to the specified output directory.
    """
    # URL for the YouTube video thumbnail (high resolution)
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"

    # Try downloading the image
    try:
        # Send an HTTP request to fetch the image
        response = requests.get(thumbnail_url, stream=True)
        # If the high resolution isn't available, fallback to other sizes
        if response.status_code != 200:
            print("High resolution thumbnail not available, trying lower resolution.")
            thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
            response = requests.get(thumbnail_url, stream=True)

        if response.status_code == 200:
            # Construct the output path
            thumbnail_path = os.path.join(output_directory, f"{video_id}_thumbnail.jpg")
            
            # Write the image to a file
            with open(thumbnail_path, 'wb') as file:
                for chunk in response.iter_content(1024):
                    file.write(chunk)
            
            print(f"Thumbnail saved to: {thumbnail_path}")
            return f"{video_id}_thumbnail.jpg"
        else:
            print(f"Error: Failed to download thumbnail for video {video_id}.")
    except Exception as e:
        print(f"Error downloading thumbnail: {e}")

# Function to convert transcript to SRT format 
def convert_to_srt(transcript, output_file):
    try:
        with open(output_file, 'w') as srt_file:
            for i, item in enumerate(transcript):
                start_time = item['start']
                end_time = start_time + item['duration']
                start_time_srt = convert_seconds_to_srt_format(start_time)
                end_time_srt = convert_seconds_to_srt_format(end_time)

                # Write the subtitle entry in SRT format
                srt_file.write(f"{i + 1}\n")
                srt_file.write(f"{start_time_srt} --> {end_time_srt}\n")
                srt_file.write(f"{item['text']}\n\n")
    except Exception as e:
        print(f"Error converting transcript to SRT: {e}")

# Helper function to format time in SRT format (HH:MM:SS,MMM)
def convert_seconds_to_srt_format(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"

def process_video(url, output_directory, download_video_flag=True, download_thumbnail_flag=True, 
                  download_transcript_flag=True, summary_video_flag=True, generate_tags_flag=True):
    # Initialize metadata dictionary
    meta_data = {
        "url": url,
        "video_id": "",
        "title": "",
        "thumbnail": "",
        "transcript_timestamp": "",
        "transcript_string": "",
        "transcript_src": "",
        "summary": "",
        "tags": []
    }

    # Extract video ID from the URL
    video_id = extract_video_id(url)
    if not video_id:
        error_message = f"no_video_id_error_{url}."
        print(error_message)
        update_log(video_id, error_message)
        return

    # Update metadata with video ID
    meta_data["video_id"] = video_id

    # Get the video title
    video_title = get_video_title(url)
    if not video_title:
        error_message = f"no_video_title_error_{url}."
        print(error_message)
        update_log(video_id, error_message)
        return

    # Update metadata with title
    meta_data["title"] = video_title

    # Download the video and audio if enabled
    if download_video_flag:
        try:
            download_video(url, output_directory, mergeOutput=True, custom_title=video_id)
        except Exception as e:
            error_message = f"no_video_mp4_error_{url}."
            print(error_message)
            update_log(video_id, error_message)

    # Download the video thumbnail if enabled
    if download_thumbnail_flag:
        try:
            thumbnail_path = download_youtube_thumbnail(video_id, output_directory)
            if thumbnail_path:
                # Update metadata with thumbnail
                meta_data["thumbnail"] = thumbnail_path
        except Exception as e:
            error_message = f"no_video_thumbnail_error_{url}."
            print(error_message)
            update_log(video_id, error_message)

    # Get the transcript if enabled
    if download_transcript_flag:
        try:
            transcript = get_transcript(video_id)
            if transcript:
                # Save the transcript as a JSON file
                output_json_file = os.path.join(output_directory, f'{video_id}.f400.json')
                save_transcript_as_json(transcript, output_json_file)
                # Update metadata with transcript
                meta_data["transcript_timestamp"] = f'{video_id}.f400.json'

                # Generate a text-only version and save it
                full_transcript = " ".join([item["text"] for item in transcript])
                output_text_file = os.path.join(output_directory, f'{video_id}.f500.json')
                save_transcript_as_json(full_transcript, output_text_file)
                # Update metadata with transcript_string
                meta_data["transcript_string"] = f'{video_id}.f500.json'

                # Convert transcript to SRT format and save it
                srt_file = os.path.join(output_directory, f"{video_id}.srt")
                convert_to_srt(transcript, srt_file)
                # Update metadata with transcript_string
                meta_data["transcript_src"] = f"{video_id}.srt"
        except Exception as e:
            error_message = f"no_transcript_error_{url}."
            print(error_message)
            update_log(video_id, error_message)

        # Summarize the transcript if enabled
        if summary_video_flag and download_transcript_flag:
            try:
                summary = summarize_text(full_transcript)
                if summary:
                    summary_json_file = os.path.join(output_directory, f'{video_id}.f600.json')
                    with open(summary_json_file, 'w') as f:
                        json.dump({"summary": summary}, f, indent=4)
                    # Update metadata with summary
                    meta_data["summary"] = f"{video_id}.f600.json"
            except Exception as e:
                error_message = f"no_summary_error_{url}."
                print(error_message)
                update_log(video_id, error_message)

    # Generate tags if enabled
    if generate_tags_flag:
        try:
            # Generate tags using the full transcript or just the title
            tags = generate_tags(full_transcript if download_transcript_flag else "", title=video_title)
            if tags:
                # Save tags as a clean, comma-separated string in JSON file
                tags_json_file = os.path.join(output_directory, f'{video_id}.tags.json')
                with open(tags_json_file, 'w') as f:
                    json.dump({"tags": tags}, f, indent=4)  # Save tags as a single string

                # Split the comma-separated tags into a list and update metadata
                meta_data["tags"] = [tag.strip() for tag in tags.split(",")]  # Split the tags into a list and remove extra spaces
        except Exception as e:
            error_message = f"no_tags_error_{url}."
            print(error_message)
            update_log(video_id, error_message)


    # Save metadata as a JSON file
    meta_data_file = os.path.join(output_directory, f'{video_id}_meta_data.json')
    with open(meta_data_file, 'w') as f:
        json.dump(meta_data, f, indent=4)

    print(f"Meta data saved for video {video_id} as {meta_data_file}")


def process_video_wrapper(args):
    url, output_directory, flags = args
    process_video(url, output_directory, **flags)


# Create log file to track processed videos
def initialize_log():
    if not os.path.exists("logs"):
        os.makedirs("logs")
    
    log_file = "logs/processed_videos_log.json"
    if not os.path.exists(log_file):
        with open(log_file, 'w') as f:
            json.dump({}, f, indent=4)
    
    return log_file

def update_log(video_id, error_message, log_file="logs/processed_videos_log.json"):
    try:
        # Read existing log data
        with open(log_file, 'r') as f:
            log_data = json.load(f)
        
        # If the video_id is not already in the log, initialize an empty list
        if video_id not in log_data:
            log_data[video_id] = []
        
        # Append the new error message
        log_data[video_id].append(error_message)
        
        # Save the updated log data
        with open(log_file, 'w') as f:
            json.dump(log_data, f, indent=4)
    
    except Exception as e:
        print(f"Error updating log file: {e}")


def merge_meta_data_jsons(input_directory, output_directory):
    # Ensure the output directory exists
    os.makedirs(output_directory, exist_ok=True)

    # Find all JSON files ending with _meta_data.json in the input directory
    meta_data_files = [
        os.path.join(root, file)
        for root, _, files in os.walk(input_directory)
        for file in files if file.endswith('_meta_data.json')
    ]

    if not meta_data_files:
        print("No meta_data.json files found in the directory.")
        return

    merged_data = []

    # Read and merge the JSON files
    for file in meta_data_files:
        try:
            with open(file, 'r') as f:
                data = json.load(f)
                merged_data.append(data)
        except json.JSONDecodeError:
            print(f"Warning: Failed to decode JSON from file {file}. Skipping...")
        except Exception as e:
            print(f"Error: {e} while processing file {file}. Skipping...")

    # Generate a random ID for the merged file
    random_id = str(uuid.uuid4())[:6]
    output_file = os.path.join(output_directory, f'{random_id}_merged.json')

    # Save the merged data
    with open(output_file, 'w') as f:
        json.dump(merged_data, f, indent=4)

    print(f"Merged JSON saved to {output_file}")
    return f'{random_id}_merged.json'

 

def limit_tags(json_file_path, output_file_path, max_tags=20):
    """
    Limits the number of tags in each video entry to the specified maximum.

    Args:
        json_file_path (str): Path to the input JSON file.
        output_file_path (str): Path to save the updated JSON file.
        max_tags (int): Maximum number of tags allowed per video entry.
    """
    # Read the JSON file
    with open(json_file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)

    # Iterate through each video entry and limit the tags
    for video in data:
        if 'tags' in video and isinstance(video['tags'], list):
            video['tags'] = video['tags'][:max_tags]  # Keep only the first `max_tags` tags

    # Save the updated JSON back to a file
    with open(output_file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4, ensure_ascii=False)

    print(f"Tags limited to {max_tags} per video. Updated JSON saved to {output_file_path}")

 
def main():
    # Output directory for downloading the files
    output_directory = "downloads"
    # Input folder which contains [{"url": "https://www.youtube.com/watch?v={videoid}"}]
    videos_to_download_json = "video_test.json"
    # Multi-process flag ==> Set to True for parallel downloads, False for sequential
    multi_process_CPU_download = False  
    # Experiment with the pool size
    pool_size = min(multiprocessing.cpu_count(), 16)  # Set maximum pool size to 16, or the number of CPU cores, whichever is smaller

    # Feature toggles
    flags = {
        "download_video_flag": False,
        "download_thumbnail_flag": False,
        "download_transcript_flag": True,
        "summary_video_flag": True,
        "generate_tags_flag": True
    }

    initialize_log()
    
    os.makedirs(output_directory, exist_ok=True)

    try:
        with open(videos_to_download_json, "r") as file:
            video_list = json.load(file)
    except FileNotFoundError:
        print(f"Error: {videos_to_download_json} not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {videos_to_download_json}")
        sys.exit(1)

    total_videos = len(video_list)
    batch_size = 10
    num_batches = (total_videos // batch_size) + (1 if total_videos % batch_size != 0 else 0)

    videos_downloaded = 0  # Initialize the counter for downloaded videos

    for batch_index in range(num_batches):
        start_index = batch_index * batch_size
        end_index = min((batch_index + 1) * batch_size, total_videos)
        batch = video_list[start_index:end_index]

        print(f"Processing batch {batch_index + 1}/{num_batches}, videos {start_index + 1} to {end_index}")

        if multi_process_CPU_download:
            with multiprocessing.Pool(processes=pool_size) as pool:
                pool.map(process_video_wrapper, [(video['url'], output_directory, flags) for video in batch])
                # Update downloaded video count after processing this batch
                videos_downloaded += len(batch)
        else:
            for video in batch:
                url = video.get("url")
                if url:
                    print(f"Processing video: {url}")
                    process_video(url, output_directory, **flags)
                    # Update downloaded video count after processing each video
                    videos_downloaded += 1

        # Display progress after each batch
        print(f"{videos_downloaded}/{total_videos} videos downloaded.")
        print(f"Batch {batch_index + 1} finished. Waiting before starting the next batch.")
        time.sleep(30)

    #merge meta-tags into 1 file
    input_directory = "downloads"
    output_directory = os.path.join(input_directory, "merge")
    output_file = merge_meta_data_jsons(input_directory, output_directory)

    # fx the tagging in the merged file(by default meta tags can be more than 20 tags)
    input_json_path = input_directory + '/merge/' + output_file  # Replace with the path to your merged JSON file
    output_json_path = input_directory + '/merge/' + 'fixed_' + output_file  # Path to save the updated JSON file
    limit_tags(input_json_path, output_json_path, max_tags=20)


if __name__ == "__main__":
    main()
