<?php

$var = new stdClass();
function tt($var) {
    if(!($var instanceof stdClass)) {
        fwrite(STDOUT, "not an instance");
    }
}
exit;




$jsonl = file('test.jsonl');

$json = json_decode(trim($jsonl[1]), true);

$totalDepth = 0;
function validateNode($node, $depth = 0, &$maxDepth = 0) {
    // Check if the node is an array
    if (!is_array($node)) {
        throw new Exception("Node must be an array.");
    }

    // Validate 'cid' (should be an array with exactly one string element)
//    if (
//        !isset($node['cid'])
//        || !is_array($node['cid'])
//        || count($node['cid']) !== 1
//        || !is_string($node['cid'][0])
//    ) {
//        throw new Exception("Invalid 'cid' element. It must be an array with exactly one string.");
//    }

    if (
        empty($node['cid'])
        || !is_string($node['cid'])
    ) {
        throw new Exception("Invalid 'cid' element. It must be non empty string.");
    }

    // Validate 'path' (should be a string)
    if (!isset($node['path']) || !is_string($node['path'])) {
        throw new Exception("Invalid 'path' element. It should be a string.");
    }

    // Update max depth
    if ($depth > $maxDepth) {
        $maxDepth = $depth;
    }

    // If 'nodes' is set, it should be an array of nodes
    if (isset($node['nodes'])) {
        if (!is_array($node['nodes'])) {
            throw new Exception("'nodes' should be an array.");
        }

        foreach ($node['nodes'] as $subNode) {
            validateNode($subNode, $depth + 1, $maxDepth);
        }
    }
}

$maxDepth = 0;
validateNode($json, 0, $maxDepth);
echo "Maximum depth: $maxDepth";
