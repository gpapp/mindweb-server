module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.initConfig({
        clean: {
            empty_dirs: {
                src: ['tmp/**/*'],
                filter: function (filepath) {
                    return (grunt.file.isDir(filepath) && require('fs').readdirSync(filepath).length === 0);
                }
            },
            gen: {
                src: ['*.js'],
                filter: function (filepath) {
                    console.log(filepath);
                    console.log(grunt.file.filename(filepath));
                    return false;
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
                    dest: 'b',
                    ext: '.js'
                }]
            }
        }
    });
    grunt.registerTask('default', ['clean', 'babel']);
}