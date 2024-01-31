<?php

// Step 1: User navigates to the OAuth URL manually to get the code
// This step typically requires manual intervention due to user authentication and authorization
// The URL is:

// https://dev.ghostdrive.com/oauth?client_id=2_5d89walcejk0okwcws0g8s0ow4og8c0s8go08sco0gsw4o4wcs&redirect_uri=https://api.dev.ghostdrive.com/oauth/v2/token&scope=user_info+workspace_create+workspace_list+file_upload+file_download+file_trash+file_delete+file_update&grant_type=authorization_code&response_type=code


$clients = [
    [
        'clientId' => '1_1xihv6nbaao0sso8sg8sso0sg8co484o8kw4s0kko4o44c8sk4',
        'clientSecret' => '3nxgrhkpi5ogw8ws8w88w00sw48cwgsg4gwc440w0sww0wgwkg',
        'redirect' => 'https://dev.neyra.ai/auth/ghostdrive'
    ],
    [
        'clientId' => '2_5d89walcejk0okwcws0g8s0ow4og8c0s8go08sco0gsw4o4wcs',
        'clientSecret' => '4a5kadsghksg8g0c8kwk8ksg0k0wokcscgkgo0owggoggk8o44',
        'redirect' => 'https://api.dev.ghostdrive.com/oauth/v2/token'
    ]
];

$client = $clients[1];

$start = "https://dev.ghostdrive.com/oauth?client_id={$client['clientId']}&redirect_uri=" . urlencode($client['redirect']) ."&scope=user_info+workspace_create+workspace_list+file_upload+file_download+file_trash+file_delete+workspace_create&grant_type=authorization_code&response_type=code";

fwrite(STDOUT, $start . "\n");
fwrite(STDOUT, "Give us code: \n");

// Step 2: Once the user has the code, they can input it here
$code = trim(fgets(STDIN));
fwrite(STDOUT, "We got the code: $code \n");

// Construct the URL to get the access token
$tokenUrl = 'https://api.dev.ghostdrive.com/oauth/v2/token?code=' . urlencode($code) . '&grant_type=authorization_code&client_id='. $client['clientId'] .'&client_secret='. $client['clientSecret'] .'&&redirect_uri=' . urlencode($client['redirect']);

// Use cURL to make the request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $tokenUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$response = curl_exec($ch);
curl_close($ch);
fwrite(STDOUT, $response);
