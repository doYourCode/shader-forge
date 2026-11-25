#version 300 es
precision highp float;

// Normal mapping without a texture: a procedural height field is differentiated
// and the slope is applied along the tangent and bitangent directions.
//
// The tangent frame is built from the interpolated world normal and tangent.
// On a real asset you would sample a normal-map texture instead.

in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec3 vWorldTangent;
in vec2 vUv;

uniform vec3 cameraPos;
uniform vec3 lightDir;

out vec4 fragColor;

void main(void)
{
    vec3 normal = normalize(vWorldNormal);
    vec3 tangent = normalize(vWorldTangent - normal * dot(normal, vWorldTangent));
    vec3 bitangent = cross(normal, tangent);

    // Height = product of two sine waves; derivatives give the slope.
    float frequency = 36.0;
    float heightX = cos(vUv.x * frequency) * sin(vUv.y * frequency);
    float heightY = sin(vUv.x * frequency) * cos(vUv.y * frequency);

    vec3 perturbed = normalize(
        normal - normalStrength * (heightX * tangent + heightY * bitangent)
    );

    float NdotL = max(dot(perturbed, normalize(lightDir)), 0.0);
    vec3 viewDirection = normalize(cameraPos - vWorldPosition);
    vec3 halfway = normalize(viewDirection + normalize(lightDir));
    float highlight = pow(max(dot(perturbed, halfway), 0.0), 48.0);

    vec3 color = albedo * (0.12 + 0.88 * NdotL) + vec3(highlight) * 0.25;

    fragColor = vec4(color, 1.0);
}
