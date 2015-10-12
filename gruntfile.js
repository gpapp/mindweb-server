module.exports = function (grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-ts');

    grunt.initConfig({
        clean: {
            gen: {
                expand: true,
                cwd: '.',
                src: ['**/*.js', '**/*.js.map', '!**/gruntfile.js', '!**/node_modules/**']
            },
            gen_def: {
                expand: true,
                cwd: '.',
                src: ['**/*.d.ts', '!**/node_modules/**', '!**/typings/**']
            },
            empty_dirs: {
                src: ['.'],
                filter: function (filepath) {
                    return (grunt.file.isDir(filepath) && require('fs').readdirSync(filepath).length === 0);
                }
            }
        },
        ts: {
            default: {
                src: ['**/*.ts', '!**/typings/**', '!**/node_modules/**'],
                dest: '.',
                options: {
                    module: 'amd', //or commonjs
                    target: 'es5', //or es3
                    sourceMap: true,
                    declaration: false
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
    grunt.registerTask('default', ['clean', 'ts', 'babel']);
}