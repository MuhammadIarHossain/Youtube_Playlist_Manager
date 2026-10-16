# YouTube Playlist Organizer — User Documentation

## 1. Overview & System Description

The **YouTube Playlist Organizer** is a web-based dashboard designed for efficient curation, management, and playback of YouTube videos and playlists. It provides a centralized interface to import content, merge playlists, eliminate duplicates automatically, manage video queues, and backup user data locally.

---

## 2. Interface Layout & Navigation

The user interface is structured into key operational panels:
<img width="1921" height="1079" alt="127 0 0 1_5500_index html (5)" src="https://github.com/user-attachments/assets/1e76e32f-d621-4521-bea8-1250c08e8c0f" />

* **Header Bar:** Displays global library statistics (Playlists, Videos, Total Duration) and global search/filter controls.
* **Import & Creation Panel:** Located near the top for quick ingestion of new video links or playlist URLs.
* **Queue Player & Library View:** Embedded player side-by-side with playlist categories and queue controls.
* **Merging & Utilities Panel:** Dedicated tools for consolidating playlists and managing local data backups.

---

## 3. Step-by-Step Operating Guide

### 3.1 Dashboard Header & Library Analytics
1. **View Library Summary:** Check the real-time counters at the top header:
   * **Total Playlists:** Number of organized playlists in your library.
   * **Total Videos:** Aggregate count of all unique videos across lists.
   * **Total Duration:** Cumulative playback time calculated across all saved videos.
2. **Search & Filter:** Use the top search bar to instantly filter playlists or locate individual videos by keyword or title.

---

### 3.2 Importing Playlists and Video Links
1. Navigate to the **Import YouTube Playlist or Links** section.
2. Paste single YouTube video URLs or full playlist URLs into the text field.
3. Select your **Import Destination**:
   * **Create New Playlist:** Enter a title to create a distinct list for the imported videos.
   * **Add into Existing:** Choose an active playlist from the dropdown menu to append the videos.
4. Click **Add Video** (or **Import**) to process and fetch metadata.

---

### 3.3 Using the YouTube Queue Player
1. **Initiate Playback:** Click any video thumbnail or title from your library to load it into the player.
2. **Queue Monitoring:**
   * **Now Playing:** Displays the active video title, duration, and channel metadata.
   * **Up Next:** Lists upcoming queued videos in sequential playback order.
3. **noEmbed Auto Mode:** Toggle **noEmbed Auto Mode** ON if embedded video playback encounters restriction errors or playback limitations.

---

### 3.4 Merging & Deduplicating Playlists
1. Scroll to the **Playlist Merging Tool** section.
2. Select two or more source playlists from your library.
3. Choose the target destination:
   * **Create New Playlist:** Combines selected sources into a brand-new list.
   * **Merge into Existing:** Appends selected sources into a pre-existing target list.
4. **Duplicate Removal (Recommended):** Check the box **"Remove duplicate videos automatically (Matches Video ID)"** to prevent identical videos from being saved multiple times.
5. **Source Cleanup (Optional):** Check **"Delete original source playlists after merge"** if you want to clean up redundant lists after consolidation.
6. Click **Merge Playlists** to execute.

---

### 3.5 Managing Individual Videos
1. Open any playlist to view its video list.
2. **Move Video:** Click **Move** on a video item, select a target playlist, and confirm. The video will be transferred and removed from the current list.
3. **Copy Video:** Click **Copy** to duplicate the video into another playlist while keeping the original intact.
4. **Remove Video:** Click the delete/trash icon next to a video. A confirmation popup (*"Are you sure you want to proceed?"*) will appear to prevent accidental removal.

---

### 3.6 Export, Backup & Settings (Including API Key Configuration)
1. **Copy Playlist Video Links:** Under **Playlist Video Links**, click **Copy All Links** to copy every YouTube URL in the current view to your system clipboard for easy sharing.
2. **Importing Data Backups:**
   * Navigate to **Import Backup**.
   * Upload a previously exported JSON backup file.
   * Choose **Add - skip duplicates** to merge backup data into your existing library without creating duplicates.
   * Choose **Replace all** to overwrite your current library completely with the backup state.
3. **Configuring Custom YouTube Data API Key:**
   * Locate the **Settings & API Config** panel on the web dashboard.
   * Enter your custom YouTube Data API Key into the designated configuration input field.
   * Save the configuration to allow the application to make direct YouTube API calls for playlist/video metadata retrieval when standard or default limits are reached.
4. **Monitoring Local Storage:**
   * Check the **Local Storage Usage** indicator within **Settings & API Config** to view browser memory consumption for stored playlists and metadata.

---

## 4. Best Practices & Troubleshooting

* **API Key Usage:** Adding a personal YouTube Data API key under **Settings & API Config** prevents metadata loading failures if default API quota limits are exceeded.
* **Avoiding Duplicates:** Always enable the **Matches Video ID** option during merging to keep libraries clean.
* **Regular Data Backups:** Periodically export your library configuration via the Backup menu to protect against browser cache clearing.
* **Playback Issues:** If a video shows a "Playback restricted" message from YouTube, enable **noEmbed Auto Mode** or open the video directly on YouTube using the provided video link.



[Live Demo](https://muhammadiarhossain.github.io/Youtube_Playlist_Manager/)



