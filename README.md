# WebGPU Shell Texturing Demo
![shell textured sphere](assets/shell-textured-sphere.png)

A WebGPU shell texturing demo built in TypeScript for the *Acerola Furry Challenge*.

Features include:

- Instanced rendering: All of the shells are drawn at once with only one draw call thanks to instanced rendering. The instance ID is used in the vertex shader to figure out what shell that vertex lays on.

- "Wind": This is poorly faked by manipulating vertex positions utilizing both sine and hash functions.

- Shell displacement: Each shell is displaced downwards in order to mimic gravity, rather than just having the fur perpendicular to the surface of the geometry. The displacement vector can be changed to any arbitrary value at runtime, and there is a variable for configuring how much more the outer shells should move than the inner shells.

- In total 15 different variables to play around and see the results in real time