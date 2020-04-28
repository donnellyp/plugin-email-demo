<?php

ob_start();

echo "\nREQUEST:\n";

echo "To: {$_REQUEST['to']}\n";
echo "From: {$_REQUEST['from']}\n";
echo "Subject: {$_REQUEST['subject']}\n";

$email = $_REQUEST['email'];
$parts = explode('Content-Type', $email);

$headers = array_shift($parts);
$results = ['boundaries' => []];

// Do as I say not as I do... I wrote this on a plane so had no access to an actual e-mail parser
// Do not recommend using this ghetto parser in the wild.
foreach ($parts as $part) {
  $line = strtok($part, "\n");
  $contentType = substr($line, 2, strpos($line, ';') - 2);
  if (in_array($contentType, ['text/plain', 'text/html'])) {
    $results[$contentType] = array_slice(explode("\n", $part), 2);
  } else {
    if (!isset($results[$contentType])) {
      $results[$contentType] = [];
    }

    $results[$contentType][] = $part;
  }
}

$taskAttributes = [
  'from' => $_REQUEST['from'],
  'to' => $_REQUEST['to'],
  'subject' => $_REQUEST['subject'],
  'plain' => implode("\n", $results['text/plain'])
];

$channelAttributes = [
  'FlexFlowSid' => '',
  'Identity' => '',
  'Target' => '',
  'ChatUserFriendlyName' => '',
  'PreEngagementData' => '',
];
 
$channelAttrString = implode('&', array_map(function($key) use ($channelAttributes) {
  return sprintf('%s=%s', $key, urlencode($channelAttributes[$key]));
}, array_keys($channelAttributes)));

$ch = curl_init('https://flex-api.twilio.com/v1/Channels');
curl_setopt($ch, CURLOPT_POST, count($channelAttributes));
curl_setopt($ch, CURLOPT_POSTFIELDS, $channelAttrString);
$channelResult = curl_exec($ch);
curl_close($ch);

print_r($channelResult);

//print_r($taskAttributes);
//print_r($results);
//var_dump($parts);

error_log(ob_get_clean(), 4);
