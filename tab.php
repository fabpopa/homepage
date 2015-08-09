<?php

	$fhandle = fopen('songs/songs.index', 'r');
	$song_index = fread($fhandle, filesize('songs/songs.index'));
	fclose($fhandle);
	
	$song_index_lines = explode("\n", $song_index);
	
	foreach ($song_index_lines as $song_entry) 
		if (trim($song_entry) != '') 
			if (strtolower(substr($song_entry, 0, strlen($_GET['song']))) == strtolower($_GET['song']))
				$song_data = explode('|__|', $song_entry);
	
	if (!isset($song_data)) 
	{
		header('Location: http://fabianpopa.com/');
		exit();
	}

?>



<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">

	<head>
		<title>Fabian Popa: <?php echo($song_data[1]); ?></title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<link rel="shortcut icon" href="favicon.ico" />
		<link media="all" type="text/css" href="../css/style_reset_selective.css" rel="stylesheet"/>
		<style type="text/css">
			a:link,a:visited,a:active {color: #0081c9; text-decoration: none;}
			a:hover {/* background-color: #f4f4f4; */ color: #c35b00;}
			body {font: 20px/1.5 Georgia, "Times New Roman", Times, serif; color: #333;}
			p {padding: 32px 0 0; width: 700px;}
			abbr {/* background-color: #f8f8f8; */}
			div.content {margin: 40px 0 0 100px;}
			ul.playlist {width: 800px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; margin-top: 34px; padding-left: 20px; border-left: 3px solid #eeeeee;}
			ul.playlist li {line-height: 20px; margin-top: 15px;}
			ul.playlist :first-child {margin-top: 0px;}
			a.play_button, a.stop_button, a.download_button, a.tab_button, a.original_button {margin: 0 0 0 8px;}
			a.stop_button {display: none;}
			div.songprogress {color:#bbbbbb; float: left; width: 36px; display: none;}
			span.songmark {color:#bbbbbb; margin:0 8px 0 0;}
			span.songdescription {color: #bbbbbb; font-size: 13px; font-style: italic; display: block;}
			pre.tab {margin: 32px 0 20px; color: #555555; font-family: Courier, monospace; font-size: 12px; line-height: 15px;}
		</style>
		<script type="text/javascript" src="../js/jquery-1.4.2.min.js"></script>
		<script type="text/javascript" src="../js/jquery.jplayer.min.js"></script>
		<script type="text/javascript">
			$(document).ready(function() {

				var song_playing_id;				

				$("#jquery_jplayer").jPlayer( {
				ready: function () {
				  /* this.element.jPlayer("setFile", "../songs/JM_smth.mp3"); */
				},
				swfPath: "../js"
				})
				.jPlayer("onProgressChange", function(lp,ppr,ppa,pt,tt) {
			 		$("#"+song_playing_id+"_progress").text(parseInt(ppa)+"%");
				})
				.jPlayer("onSoundComplete", function() {
			 		$("#"+song_playing_id+"_stop").click();
				});
				
				$("a.play_button").click(function (e) {
					e.preventDefault();	// stop the browser from loading /#
					
					if (song_playing_id != "") {
						$("#"+song_playing_id+"_stop").click();	//stop currently playing song
					}
					song_playing_id = $(this).attr("id"); 
					
					$(this).css("display", "none");
					$("#"+song_playing_id+"_stop").css("display", "inline");
					
					$("#"+song_playing_id+"_mark").css("display", "none");
					$("#"+song_playing_id+"_progress").css("display", "inline");
					
					$("#jquery_jplayer").jPlayer("setFile", "../songs/"+song_playing_id+".mp3").jPlayer("play");
				});

				$("a.stop_button").click(function (e) {
					e.preventDefault();	// stop the browser from loading /#
					
					$(this).css("display", "none");
					$("#"+song_playing_id).css("display", "inline");
					$("#"+song_playing_id+"_mark").html("&#9835;");
					
					$("#"+song_playing_id+"_progress").css("display", "none");
					$("#"+song_playing_id+"_mark").css("display", "inline");
					
					song_playing_id = "";
					
					$("#jquery_jplayer").jPlayer("stop");
				});
				
			});
		</script>
	</head>
	
	<body>
	
		<script type="text/javascript">
		  var _gaq = _gaq || [];
		  _gaq.push(['_setAccount', 'UA-1569129-2']);
		  _gaq.push(['_trackPageview']);
		  (function() {
		    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
		    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
		    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
		  })();
		</script>	
	
		<div id="jquery_jplayer"></div>
		<div class="content">
			<ul class="playlist">
				<li>
					<span class="songmark" id="<?php echo($song_data[0]); ?>_mark">&#9835;</span>
					<div class="songprogress" id="<?php echo($song_data[0]); ?>_progress"></div>
					<?php echo($song_data[1]); ?>
					<a href="#" class="play_button" id="<?php echo($song_data[0]); ?>">play</a>
					<a href="#" class="stop_button" id="<?php echo($song_data[0]); ?>_stop">stop</a>
					<a href="../songs/<?php echo($song_data[0]); ?>.mp3" class="download_button">download</a>
					<a href="<?php echo($song_data[3]); ?>" class="original_button">original</a>
					<span class="songdescription"><?php echo($song_data[2]); ?></span>
				</li>
			</ul>
			<a href="../">&larr;</a>

			<pre class="tab">
<?php $fhandle = fopen('songs/'.$song_data[0].'.txt', 'r'); $tab = fread($fhandle, filesize('songs/'.$song_data[0].'.txt')); fclose($fhandle); echo $tab; ?>
			</pre>
			
			<a href="../">&larr;</a>
			<br /><br /><br />
		</div>
	</body>

</html>