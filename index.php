<?php

	$fhandle = fopen('songs/songs.index', 'r');
	$song_index = fread($fhandle, filesize('songs/songs.index'));
	fclose($fhandle);
	
	$song_index_lines = explode("\n", $song_index);

?>



<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">

	<head>
		<title>Fabian Popa</title>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<link rel="shortcut icon" href="favicon.ico" />
		<link media="all" type="text/css" href="css/style_reset_selective.css" rel="stylesheet"/>	
		<style type="text/css">
			a:link,a:visited,a:active {color: #0081c9; text-decoration: none;}
			a:hover {color: #c35b00;}
			body {font: 20px/1.5 Georgia, "Times New Roman", Times, serif; color: #333;}
			p {padding: 25px 0 0;}
			div.content {margin: 40px 0 0 100px;}
			ul.playlist {width: 800px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; margin: 40px 0 14px; padding-left: 20px; border-left: 3px solid #eeeeee;}
			ul.playlist li {line-height: 20px; margin-top: 15px;}
			ul.playlist :first-child {margin-top: 0px;}
			a.play_button, a.stop_button, a.download_button, a.tab_button, a.original_button {margin: 0 0 0 8px;}
			a.stop_button {display: none;}
			div.songprogress {color:#bbbbbb; float: left; width: 36px; display: none;}
			span.songmark {color:#bbbbbb; margin:0 8px 0 0;}
			span.songdescription {color: #c1c4c6; font-size: 13px; font-style: italic; display: block;}
		</style>
		<script type="text/javascript" src="js/jquery-1.4.2.min.js"></script>
		<script type="text/javascript" src="js/jquery.jplayer.min.js"></script>
		<script type="text/javascript">
			$(document).ready(function() {

				var song_playing_id;				

				$("#jquery_jplayer").jPlayer( {
				ready: function () {
				  /* this.element.jPlayer("setFile", "songs/JM_smth.mp3"); */
				}
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
					
					$("#jquery_jplayer").jPlayer("setFile", "songs/"+song_playing_id+".mp3").jPlayer("play");
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

		<div class="content">
			<p>Hi, I am <abbr title="Nice to see you!">Fabian Popa</abbr>, a <a href="http://www.cmu.edu">CMU</a> grad, <a href="http://www.tum.de">TUM</a> alumnus, and a native of <a href="http://en.wikipedia.org/wiki/Bra%C5%9Fov">Bra&#537;ov</a>.<br>Have a look at my <a href="http://twitter.com/fabpopa">tweets</a> or <a href="http://www.facebook.com/fabpopa/">facebook</a> to catch up on things.</p>
			<p>Here's some music I've recorded:</p>
			
			<div id="jquery_jplayer"></div>

			<ul class="playlist">
			<?php foreach ($song_index_lines as $song_entry) if (trim($song_entry) != '') { $song_data = explode('|__|', $song_entry); ?>
				<li>
					<span class="songmark" id="<?php echo($song_data[0]); ?>_mark">&#9835;</span>
					<div class="songprogress" id="<?php echo($song_data[0]); ?>_progress"></div>
					<?php echo($song_data[1]); ?>
					<a href="#" class="play_button" id="<?php echo($song_data[0]); ?>">play</a>
					<a href="#" class="stop_button" id="<?php echo($song_data[0]); ?>_stop">stop</a>
					<a href="songs/<?php echo($song_data[0]); ?>.mp3" class="download_button">download</a>
					<a href="tab/<?php echo($song_data[0]); ?>" class="tab_button">tab</a>
					<a href="<?php echo($song_data[3]); ?>" class="original_button">original</a>
					<span class="songdescription"><?php echo($song_data[2]); ?></span>
				</li>
			<?php } ?>
			</ul>
			
			<p>Glad you stopped by! I'll see you later.</p>
			
			<p>
				<!-- crazy spam-fighting ninja action -->
				<script type="text/javascript">
				//<![CDATA[
				<!--
				var x="function f(x){var i,o=\"\",ol=x.length,l=ol;while(x.charCodeAt(l/13)!" +
				"=57){try{x+=x;l+=l;}catch(e){}}for(i=l-1;i>=0;i--){o+=x.charAt(i);}return o" +
				".substr(0,ol);}f(\")511,\\\"]U_J@_100\\\\pb5?.5-x9?u 6520\\\\or320\\\\+#%'j" +
				"(h\\\"\\\\+e4,0500\\\\bc300\\\\XPOSM030\\\\520\\\\j520\\\\030\\\\Zz410\\\\D" +
				"LKGN^Y620\\\\EHE310\\\\ESMQN~w771\\\\}}Z{yq,z`771\\\\{p}-R0jnxa(f:',mndt720" +
				"\\\\710\\\\310\\\\U610\\\\720\\\\530\\\\230\\\\300\\\\620\\\\330\\\\720\\\\" +
				"\\\"(f};o nruter};))++y(^)i(tAedoCrahc.x(edoCrahCmorf.gnirtS=+o;721=%y{)++i" +
				";l<i;0=i(rof;htgnel.x=l,\\\"\\\"=o,i rav{)y,x(f noitcnuf\")"                 ;
				while(x=eval(x));
				//-->
				//]]>
				</script>
			</p>
		</div>
	</body>

</html>