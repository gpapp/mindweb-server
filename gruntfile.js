module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.initConfig({
        clean: {
            gen: {
                expand: true,
                cwd: '.',
                src: ['**/*.js','**/*.js.map','!**/gruntfile.js', '!**/node_modules/**']
            },
            empty_dirs: {
                src: ['.'],
                filter: function (filepath) {
                    return (grunt.file.isDir(filepath) && require('fs').readdirSync(filepath).length === 0);
                }
            }
        },
        babel: {
            options: {
                sourceMap: true,
                retainLines: true
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: '.',
                    src: ['**/*.es6'],
                    dest: '.',
                    ext: '.js'
                }]
            }
        }
    });
    grunt.registerTask('default', ['clean', 'babel']);
}